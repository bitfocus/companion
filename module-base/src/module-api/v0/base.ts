import * as SocketIOClient from 'socket.io-client'
import { CompanionInputField } from './input.js'
import { CompanionAction, CompanionActions } from './action.js'
import {
	CompanionFeedbacks,
	CompanionFeedback,
	CompanionFeedbackButtonStyleResult,
	CompanionFeedbackEvent,
	CompanionFeedbackBooleanEvent,
	CompanionFeedbackAdvancedEvent,
} from './feedback.js'
import { SomeCompanionPreset } from './preset.js'
import { InstanceStatus, LogLevel } from './enums.js'
import {
	ActionInstance,
	ExecuteActionMessage,
	FeedbackInstance,
	HostToModuleEventsV0,
	LogMessageMessage,
	ModuleToHostEventsV0,
	SendOscMessage,
	SetActionDefinitionsMessage,
	SetFeedbackDefinitionsMessage,
	SetStatusMessage,
	SetVariableDefinitionsMessage,
	SetVariableValuesMessage,
	UpdateActionInstancesMessage,
	UpdateFeedbackInstancesMessage,
	UpdateFeedbackValuesMessage,
} from '../../host-api/v0.js'
import { literal } from '../../util.js'
import { InstanceBaseShared } from '../../instance-base.js'
import { ResultCallback } from '../../host-api/versions.js'
import PQueue from 'p-queue'
import { CompanionVariable, CompanionVariableValue, CompanionVariableValue2 } from './variable.js'
import { OSCSomeArguments } from '../../common/osc.js'
import { listenToEvents } from '../lib.js'

function convertFeedbackInstanceToEvent(
	type: 'boolean' | 'advanced',
	feedback: FeedbackInstance
): CompanionFeedbackEvent {
	return {
		type: type,
		id: feedback.id,
		feedbackId: feedback.feedbackId,
		controlId: feedback.controlId,
		options: feedback.options,
	}
}

function callFeedbackOnDefinition(definition: CompanionFeedback, feedback: FeedbackInstance) {
	if (definition.type === 'boolean') {
		return definition.callback({
			...convertFeedbackInstanceToEvent('boolean', feedback),
			type: 'boolean',
			rawBank: feedback.rawBank,
		})
	} else {
		return definition.callback({
			...convertFeedbackInstanceToEvent('advanced', feedback),
			type: 'advanced',
			image: feedback.image,
			page: feedback.page,
			bank: feedback.bank,
			rawBank: feedback.rawBank,
		})
	}
}

export abstract class InstanceBaseV0<TConfig> implements InstanceBaseShared<TConfig> {
	readonly #socket: SocketIOClient.Socket
	public readonly id: string
	public readonly label: string

	readonly #lifecycleQueue: PQueue = new PQueue({ concurrency: 1 })
	#initialized: boolean = false

	readonly #actionDefinitions = new Map<string, CompanionAction>()
	readonly #feedbackDefinitions = new Map<string, CompanionFeedback>()
	readonly #variableDefinitions = new Map<string, CompanionVariable>()

	readonly #feedbackInstances = new Map<string, FeedbackInstance>()
	readonly #actionInstances = new Map<string, ActionInstance>()
	readonly #variableValues = new Map<string, CompanionVariableValue>()

	/**
	 * Create an instance of the module.
	 */
	constructor(internal: unknown, id: string, label: string) {
		const socket = internal as SocketIOClient.Socket // TODO - can this be safer?
		if (!socket.connected || typeof id !== 'string')
			throw new Error(
				`Module instance is being constructed incorrectly. Make sure you aren't trying to do this manually`
			)

		this.#socket = socket
		this.id = id
		this.label = label

		// subscribe to socket events from host
		listenToEvents<HostToModuleEventsV0>(socket, {
			init: this._handleInit.bind(this),
			destroy: this._handleDestroy.bind(this),
			updateConfig: this._handleConfigUpdate.bind(this),
			executeAction: this._handleExecuteAction.bind(this),
			updateFeedbacks: this._handleUpdateFeedbacks.bind(this),
			updateActions: this._handleUpdateActions.bind(this),
		})

		this.updateStatus(null, 'Initializing')
		this.userLog(LogLevel.DEBUG, 'Initializing')
	}

	private async _socketEmit<T extends keyof ModuleToHostEventsV0>(
		name: T,
		msg: Parameters<ModuleToHostEventsV0[T]>[0]
	): Promise<ReturnType<ModuleToHostEventsV0[T]>> {
		return new Promise<ReturnType<ModuleToHostEventsV0[T]>>((resolve, reject) => {
			const innerCb: ResultCallback<ReturnType<ModuleToHostEventsV0[T]>> = (
				err: any,
				res: ReturnType<ModuleToHostEventsV0[T]>
			): void => {
				if (err) reject(err)
				else resolve(res)
			}
			this.#socket.emit(name, msg, innerCb)
		})
	}

	private async _handleInit(config: unknown): Promise<void> {
		await this.#lifecycleQueue.add(async () => {
			if (this.#initialized) throw new Error('Already initialized')

			await this.init(config as TConfig)

			this.#initialized = true
		})
	}
	private async _handleDestroy(): Promise<void> {
		await this.#lifecycleQueue.add(async () => {
			if (!this.#initialized) throw new Error('Not initialized')

			await this.destroy()

			this.#initialized = false
		})
	}
	private async _handleConfigUpdate(config: unknown): Promise<void> {
		await this.#lifecycleQueue.add(async () => {
			if (!this.#initialized) throw new Error('Not initialized')

			await this.configUpdated(config as TConfig)
		})
	}
	private async _handleExecuteAction(msg: ExecuteActionMessage): Promise<void> {
		const actionDefinition = this.#actionDefinitions.get(msg.action.actionId)
		if (!actionDefinition) throw new Error(`Unknown action`)

		await actionDefinition.callback({
			id: msg.action.id,
			actionId: msg.action.actionId,
			controlId: msg.action.controlId,
			options: msg.action.options,

			deviceId: msg.action.deviceId,
			page: msg.action.page,
			bank: msg.action.bank,
		})
	}
	private async _handleUpdateFeedbacks(msg: UpdateFeedbackInstancesMessage): Promise<void> {
		const newValues: UpdateFeedbackValuesMessage['values'] = []

		for (const [id, feedback] of Object.entries(msg.feedbacks)) {
			const existing = this.#feedbackInstances.get(id)
			const definition = existing && this.#feedbackDefinitions.get(existing.feedbackId)
			if (existing) {
				// Call unsubscribe
				if (definition?.unsubscribe) {
					try {
						definition.unsubscribe(convertFeedbackInstanceToEvent(definition.type, existing))
					} catch (e) {
						// TODO
					}
				}
			}

			if (!feedback) {
				// Deleted
				this.#feedbackInstances.delete(id)
			} else {
				// TODO - deep freeze the feedback to avoid mutation
				this.#feedbackInstances.set(id, feedback)

				// Inserted or updated
				if (definition?.subscribe) {
					try {
						definition.subscribe(convertFeedbackInstanceToEvent(definition.type, feedback))
					} catch (e) {
						// TODO
					}
				}

				// Calculate the new value for the feedback
				if (definition) {
					let value: boolean | Partial<CompanionFeedbackButtonStyleResult> | undefined
					try {
						value = callFeedbackOnDefinition(definition, feedback)
					} catch (e) {
						// TODO
					}
					newValues.push({
						id: id,
						controlId: feedback.controlId,
						value: value,
					})
				}
			}
		}

		// Send the new values back
		if (Object.keys(newValues).length > 0) {
			await this._socketEmit('updateFeedbackValues', {
				values: newValues,
			})
		}
	}
	private async _handleUpdateActions(msg: UpdateActionInstancesMessage): Promise<void> {
		for (const [id, action] of Object.entries(msg.actions)) {
			const existing = this.#actionInstances.get(id)
			const definition = existing && this.#actionDefinitions.get(existing.actionId)
			if (existing) {
				// Call unsubscribe
				if (definition?.unsubscribe) {
					try {
						definition.unsubscribe(existing)
					} catch (e) {
						// TODO
					}
				}
			}

			if (!action) {
				// Deleted
				this.#actionInstances.delete(id)
			} else {
				// TODO - deep freeze the feedback to avoid mutation
				this.#actionInstances.set(id, action)

				// Inserted or updated
				if (definition?.subscribe) {
					try {
						definition.subscribe(action)
					} catch (e) {
						// TODO
					}
				}
			}
		}
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 */
	abstract init(config: TConfig): void | Promise<void>

	/**
	 * Clean up the instance before it is destroyed.
	 */
	abstract destroy(): void | Promise<void>

	/**
	 * Process an updated configuration array.
	 */
	abstract configUpdated(config: TConfig): void | Promise<void>

	async saveConfig(newConfig: TConfig): Promise<void> {
		return this._socketEmit('saveConfig', { config: newConfig })
	}

	/**
	 * Creates the configuration fields for web config.
	 */
	abstract getConfigFields(): CompanionInputField[]

	setActionDefinitions(actions: CompanionActions): Promise<void> {
		const hostActions: SetActionDefinitionsMessage['actions'] = []

		this.#actionDefinitions.clear()

		for (const [actionId, action] of Object.entries(actions)) {
			if (action) {
				hostActions.push({
					id: actionId,
					name: action.name,
					description: action.description,
					options: action.options,
				})

				// Remember the definition locally
				this.#actionDefinitions.set(actionId, action)
			}
		}

		return this._socketEmit('setActionDefinitions', { actions: hostActions })
	}

	setFeedbackDefinitions(feedbacks: CompanionFeedbacks): Promise<void> {
		const hostFeedbacks: SetFeedbackDefinitionsMessage['feedbacks'] = []

		this.#feedbackDefinitions.clear()

		for (const [feedbackId, feedback] of Object.entries(feedbacks)) {
			if (feedback) {
				hostFeedbacks.push({
					id: feedbackId,
					name: feedback.name,
					description: feedback.description,
					options: feedback.options,
					type: feedback.type,
					defaultStyle: 'defaultStyle' in feedback ? feedback.defaultStyle : undefined,
				})

				// Remember the definition locally
				this.#feedbackDefinitions.set(feedbackId, feedback)
			}
		}

		return this._socketEmit('setFeedbackDefinitions', { feedbacks: hostFeedbacks })
	}

	setPresetDefinitions(_presets: SomeCompanionPreset[]): Promise<void> {
		// return this.system.setPresetDefinitions(presets);
		return Promise.resolve()
	}

	setVariableDefinitions(variables: CompanionVariable[]): Promise<void> {
		const hostVariables: SetVariableDefinitionsMessage['variables'] = []

		this.#variableDefinitions.clear()

		for (const variable of variables) {
			hostVariables.push({
				id: variable.variableId,
				name: variable.name,
			})

			// Remember the definition locally
			this.#variableDefinitions.set(variable.variableId, variable)
			if (!this.#variableValues.has(variable.variableId)) {
				// Give us a local cached value of something
				this.#variableValues.set(variable.variableId, '')
			}
		}

		const validIds = new Set(this.#variableDefinitions.keys())
		for (const id of this.#variableValues.keys()) {
			if (!validIds.has(id)) {
				// Delete any local cached value
				this.#variableValues.delete(id)
			}
		}

		return this._socketEmit('setVariableDefinitions', { variables: hostVariables })
	}

	setVariableValues(values: CompanionVariableValue2[]): Promise<void> {
		const hostValues: SetVariableValuesMessage['newValues'] = []

		for (const value of values) {
			if (this.#variableDefinitions.has(value.variableId)) {
				// update the cached value
				this.#variableValues.set(value.variableId, value.value || '')

				hostValues.push({
					id: value.variableId,
					value: value.value || '',
				})
			}
		}

		return this._socketEmit('setVariableValues', { newValues: hostValues })
	}

	getVariableValue(variableId: string): string | undefined {
		return this.#variableValues.get(variableId)
	}

	async checkFeedbacks(...feedbackTypes: string[]): Promise<void> {
		const newValues: UpdateFeedbackValuesMessage['values'] = []

		const types = new Set(feedbackTypes)
		for (const [id, feedback] of this.#feedbackInstances.entries()) {
			const definition = this.#feedbackDefinitions.get(feedback.feedbackId)
			if (definition) {
				if (types.size > 0 && !types.has(feedback.feedbackId)) {
					// Not to be considered
					continue
				}

				// Calculate the new value for the feedback
				let value: boolean | Partial<CompanionFeedbackButtonStyleResult> | undefined
				try {
					value = callFeedbackOnDefinition(definition, feedback)
				} catch (e) {
					// TODO
				}
				newValues.push({
					id: id,
					controlId: feedback.controlId,
					value: value,
				})
			}
		}

		// Send the new values back
		if (Object.keys(newValues).length > 0) {
			await this._socketEmit('updateFeedbackValues', {
				values: newValues,
			})
		}
	}

	async checkFeedbacksById(...feedbackIds: string[]): Promise<void> {
		const newValues: UpdateFeedbackValuesMessage['values'] = []

		for (const id of feedbackIds) {
			const feedback = this.#feedbackInstances.get(id)
			const definition = feedback && this.#feedbackDefinitions.get(feedback.feedbackId)
			if (feedback && definition) {
				// Calculate the new value for the feedback
				let value: boolean | Partial<CompanionFeedbackButtonStyleResult> | undefined
				try {
					value = callFeedbackOnDefinition(definition, feedback)
				} catch (e) {
					// TODO
				}
				newValues.push({
					id: id,
					controlId: feedback.controlId,
					value: value,
				})
			}
		}

		// Send the new values back
		if (Object.keys(newValues).length > 0) {
			await this._socketEmit('updateFeedbackValues', {
				values: newValues,
			})
		}
	}

	/** @deprecated ? */
	getAllActions() {
		return Array.from(this.#actionInstances.values())
	}
	/** @deprecated ? */
	subscribeActions(actionId?: string): void {
		let actions = this.getAllActions()
		if (actionId) actions = actions.filter((fb) => fb.actionId === actionId)

		for (const act of actions) {
			const def = this.#actionDefinitions.get(act.actionId)
			if (def && def.subscribe) {
				def.subscribe({
					id: act.id,
					actionId: act.actionId,
					controlId: act.controlId,
					options: act.options,
				})
			}
		}
	}
	/** @deprecated ? */
	unsubscribeActions(actionId?: string): void {
		let actions = this.getAllActions()
		if (actionId) actions = actions.filter((fb) => fb.actionId === actionId)

		for (const act of actions) {
			const def = this.#actionDefinitions.get(act.actionId)
			if (def && def.unsubscribe) {
				def.unsubscribe({
					id: act.id,
					actionId: act.actionId,
					controlId: act.controlId,
					options: act.options,
				})
			}
		}
	}

	/** @deprecated ? */
	getAllFeedbacks() {
		return Array.from(this.#feedbackInstances.values())
	}
	/** @deprecated ? */
	subscribeFeedbacks(feedbackId?: string): void {
		let feedbacks = this.getAllFeedbacks()
		if (feedbackId) feedbacks = feedbacks.filter((fb) => fb.feedbackId === feedbackId)

		for (const fb of feedbacks) {
			const def = this.#feedbackDefinitions.get(fb.feedbackId)
			if (def && def.subscribe) {
				def.subscribe({
					type: def.type,
					id: fb.id,
					feedbackId: fb.feedbackId,
					controlId: fb.controlId,
					options: fb.options,
				})
			}
		}
	}
	/** @deprecated ? */
	unsubscribeFeedbacks(feedbackId?: string): void {
		let feedbacks = this.getAllFeedbacks()
		if (feedbackId) feedbacks = feedbacks.filter((fb) => fb.feedbackId === feedbackId)

		for (const fb of feedbacks) {
			const def = this.#feedbackDefinitions.get(fb.feedbackId)
			if (def && def.unsubscribe) {
				def.unsubscribe({
					type: def.type,
					id: fb.id,
					feedbackId: fb.feedbackId,
					controlId: fb.controlId,
					options: fb.options,
				})
			}
		}
	}

	/**
	 * Send an osc message from the system osc sender
	 * @param host destination ip address
	 * @param port destination port number
	 * @param path message path
	 * @param args mesage arguments
	 */
	async oscSend(host: string, port: number, path: string, args: OSCSomeArguments): Promise<void> {
		return this._socketEmit(
			'send-osc',
			literal<SendOscMessage>({
				host,
				port,
				path,
				args,
			})
		)
	}

	updateStatus(status: InstanceStatus | null, message?: string | null): void {
		this._socketEmit(
			'set-status',
			literal<SetStatusMessage>({
				status,
				message: message ?? null,
			})
		).catch((e) => {
			console.error(`updateStatus failed: ${e}`)
		})
	}

	userLog(level: LogLevel, message: string): void {
		this._socketEmit(
			'log-message',
			literal<LogMessageMessage>({
				level,
				message,
			})
		).catch((e) => {
			console.error(`log failed: ${e}`)
		})
	}
}
