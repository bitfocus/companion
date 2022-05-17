import * as SocketIOClient from 'socket.io-client'
import { CompanionAction, CompanionActions } from './action.js'
import {
	CompanionFeedbacks,
	CompanionFeedback,
	CompanionFeedbackButtonStyleResult,
	CompanionFeedbackEvent,
} from './feedback.js'
import { SomeCompanionPreset } from './preset.js'
import { InstanceStatus, LogLevel } from './enums.js'
import {
	ActionInstance,
	ExecuteActionMessage,
	FeedbackInstance,
	GetConfigFieldsMessage,
	GetConfigFieldsResponseMessage,
	HostToModuleEventsV0,
	InitMessage,
	InitResponseMessage,
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
	UpgradedDataResponseMessage,
} from '../host-api/api.js'
import { literal } from '../util.js'
import { InstanceBaseShared } from '../instance-base.js'
import { ResultCallback } from '../host-api/versions.js'
import PQueue from 'p-queue'
import { CompanionVariable, CompanionVariableValue, CompanionVariableValue2 } from './variable.js'
import { OSCSomeArguments } from '../common/osc.js'
import { listenToEvents, serializeIsVisibleFn } from './lib.js'
import { SomeCompanionConfigField } from './config.js'
import { CompanionStaticUpgradeScript, CompanionUpgradeToBooleanFeedbackMap } from './upgrade.js'
import { isInstanceBaseProps, runThroughUpgradeScripts } from './internal.js'

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

export abstract class InstanceBase<TConfig> implements InstanceBaseShared<TConfig> {
	readonly #socket: SocketIOClient.Socket
	readonly #upgradeScripts: CompanionStaticUpgradeScript<TConfig>[]
	public readonly id: string

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
	constructor(internal: unknown) {
		if (!isInstanceBaseProps<TConfig>(internal) || !internal.socket.connected)
			throw new Error(
				`Module instance is being constructed incorrectly. Make sure you aren't trying to do this manually`
			)

		this.#socket = internal.socket
		this.#upgradeScripts = internal.upgradeScripts
		this.id = internal.id

		// subscribe to socket events from host
		listenToEvents<HostToModuleEventsV0>(this.#socket, {
			init: this._handleInit.bind(this),
			destroy: this._handleDestroy.bind(this),
			updateConfig: this._handleConfigUpdate.bind(this),
			executeAction: this._handleExecuteAction.bind(this),
			updateFeedbacks: this._handleUpdateFeedbacks.bind(this),
			updateActions: this._handleUpdateActions.bind(this),
			getConfigFields: this._handleGetConfigFields.bind(this),
		})

		this.log('debug', 'Initializing')
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

	private async _handleInit(msg: InitMessage): Promise<InitResponseMessage> {
		return this.#lifecycleQueue.add(async () => {
			if (this.#initialized) throw new Error('Already initialized')

			const actions = msg.actions
			const feedbacks = msg.feedbacks

			/**
			 * Performing upgrades during init requires a fair chunk of work.
			 * Some actions/feedbacks will be using the upgradeIndex of the instance, but some may have their own upgradeIndex on themselves if they are from an import.
			 */
			const { updatedActions, updatedFeedbacks, updatedConfig } = runThroughUpgradeScripts(
				actions,
				feedbacks,
				msg.lastUpgradeIndex,
				this.#upgradeScripts,
				msg.config
			)
			const config = (updatedConfig ?? msg.config) as TConfig

			// Send the upgraded data back to companion now. Just so that if the init crashes, this doesnt have to be repeated
			const pSendUpgrade = this._socketEmit('upgradedItems', {
				updatedActions,
				updatedFeedbacks,
			})

			// Now we can initialise the module
			try {
				await this.init(config)

				this.#initialized = true
			} catch (e) {
				console.trace(`Init failed: ${e}`)
				throw e
			} finally {
				// Only now do we need to await the upgrade
				await pSendUpgrade
			}

			setImmediate(() => {
				// Subscribe all of the actions and feedbacks
				this._handleUpdateActions({ actions }, true)
				this._handleUpdateFeedbacks({ feedbacks }, true)
			})

			return {
				newUpgradeIndex: this.#upgradeScripts.length,
				updatedConfig: config,
			}
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
		if (!actionDefinition) throw new Error(`Unknown action: ${msg.action.actionId}`)

		await actionDefinition.callback({
			id: msg.action.id,
			actionId: msg.action.actionId,
			controlId: msg.action.controlId,
			options: msg.action.options,

			deviceId: msg.deviceId,
			page: msg.action.page,
			bank: msg.action.bank,
		})
	}
	private async _handleUpdateFeedbacks(msg: UpdateFeedbackInstancesMessage, skipUpgrades?: boolean): Promise<void> {
		const newValues: UpdateFeedbackValuesMessage['values'] = []

		// Run through upgrade scripts if needed
		if (!skipUpgrades) {
			runThroughUpgradeScripts({}, msg.feedbacks, null, this.#upgradeScripts, undefined)
		}

		for (const [id, feedback] of Object.entries(msg.feedbacks)) {
			const existing = this.#feedbackInstances.get(id)
			const feedbackId = existing?.feedbackId ?? feedback?.feedbackId
			const definition = feedbackId ? this.#feedbackDefinitions.get(feedbackId) : null
			if (existing) {
				// Call unsubscribe
				if (definition?.unsubscribe) {
					try {
						definition.unsubscribe(convertFeedbackInstanceToEvent(definition.type, existing))
					} catch (e: any) {
						console.error(`Feedback unsubscribe failed: ${JSON.stringify(existing)} - ${e?.message ?? e} ${e?.stack}`)
					}
				}
			}

			if (!feedback) {
				// Deleted
				this.#feedbackInstances.delete(id)
			} else {
				// TODO module-lib - deep freeze the feedback to avoid mutation?
				this.#feedbackInstances.set(id, feedback)

				// Inserted or updated
				if (definition?.subscribe) {
					try {
						definition.subscribe(convertFeedbackInstanceToEvent(definition.type, feedback))
					} catch (e: any) {
						console.error(`Feedback subscribe failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
					}
				}

				// Calculate the new value for the feedback
				if (definition) {
					let value: boolean | Partial<CompanionFeedbackButtonStyleResult> | undefined
					try {
						value = callFeedbackOnDefinition(definition, feedback)
					} catch (e: any) {
						console.error(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
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
	private async _handleUpdateActions(msg: UpdateActionInstancesMessage, skipUpgrades?: boolean): Promise<void> {
		// Run through upgrade scripts if needed
		if (!skipUpgrades) {
			// const pendingUpgrades = Object.values(msg.actions).filter((act) => typeof act?.upgradeIndex === 'number')
			// if (pendingUpgrades.length > 0) {
			// 	//
			// }
			runThroughUpgradeScripts(msg.actions, {}, null, this.#upgradeScripts, undefined)
		}

		for (const [id, action] of Object.entries(msg.actions)) {
			const existing = this.#actionInstances.get(id)
			const definition = existing && this.#actionDefinitions.get(existing.actionId)
			if (existing) {
				// Call unsubscribe
				if (definition?.unsubscribe) {
					try {
						definition.unsubscribe(existing)
					} catch (e: any) {
						console.error(`Action unsubscribe failed: ${JSON.stringify(existing)} - ${e?.message ?? e} ${e?.stack}`)
					}
				}
			}

			if (!action) {
				// Deleted
				this.#actionInstances.delete(id)
			} else {
				// TODO module-lib - deep freeze the action to avoid mutation?
				this.#actionInstances.set(id, action)

				// Inserted or updated
				if (definition?.subscribe) {
					try {
						definition.subscribe(action)
					} catch (e: any) {
						console.error(`Action subscribe failed: ${JSON.stringify(action)} - ${e?.message ?? e} ${e?.stack}`)
					}
				}
			}
		}
	}

	private async _handleGetConfigFields(_msg: GetConfigFieldsMessage): Promise<GetConfigFieldsResponseMessage> {
		return {
			fields: serializeIsVisibleFn(this.getConfigFields()),
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
	abstract getConfigFields(): SomeCompanionConfigField[]

	// /**
	//  * Provides the upgrade scripts to companion that are to be used for this module.
	//  * These get run before init is called, so should not rely on the class being fully initialized.
	//  */
	// GetUpgradeScripts?(): Array<CompanionStaticUpgradeScript<any>>

	// /**
	//  * Force running upgrade script from an earlier point, as specified by the value
	//  * Only works when DEVELOPER=1.
	//  * eg, 0 = runs the first script onwards
	//  */
	// static DEVELOPER_forceStartupUpgradeScript?: number

	setActionDefinitions(actions: CompanionActions): Promise<void> {
		const hostActions: SetActionDefinitionsMessage['actions'] = []

		this.#actionDefinitions.clear()

		for (const [actionId, action] of Object.entries(actions)) {
			if (action) {
				hostActions.push({
					id: actionId,
					name: action.name,
					description: action.description,
					options: serializeIsVisibleFn(action.options),
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
					options: serializeIsVisibleFn(feedback.options),
					type: feedback.type,
					defaultStyle: 'defaultStyle' in feedback ? feedback.defaultStyle : undefined,
				})

				// Remember the definition locally
				this.#feedbackDefinitions.set(feedbackId, feedback)
			}
		}

		return this._socketEmit('setFeedbackDefinitions', { feedbacks: hostFeedbacks })
	}

	setPresetDefinitions(presets: SomeCompanionPreset[]): Promise<void> {
		// const hostPresets: SetPresetDefinitionsMessage['presets'] = []

		// for (const preset of presets) {
		// 	hostPresets.push({
		// 		//
		// 	})
		// }

		return this._socketEmit('setPresetDefinitions', { presets: presets })
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
			} else {
				// tell companion to delete the value
				hostValues.push({
					id: value.variableId,
					value: undefined,
				})
			}
		}

		return this._socketEmit('setVariableValues', { newValues: hostValues })
	}

	getVariableValue(variableId: string): string | undefined {
		return this.#variableValues.get(variableId)
	}

	async parseVariablesInString(text: string): Promise<string> {
		const res = await this._socketEmit('parseVariablesInString', { text: text })
		return res.text
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

				try {
					// Calculate the new value for the feedback
					newValues.push({
						id: id,
						controlId: feedback.controlId,
						value: callFeedbackOnDefinition(definition, feedback),
					})
				} catch (e: any) {
					console.error(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
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

	async checkFeedbacksById(...feedbackIds: string[]): Promise<void> {
		const newValues: UpdateFeedbackValuesMessage['values'] = []

		for (const id of feedbackIds) {
			const feedback = this.#feedbackInstances.get(id)
			const definition = feedback && this.#feedbackDefinitions.get(feedback.feedbackId)
			if (feedback && definition) {
				try {
					// Calculate the new value for the feedback
					newValues.push({
						id: id,
						controlId: feedback.controlId,
						value: callFeedbackOnDefinition(definition, feedback),
					})
				} catch (e: any) {
					console.error(`Feedback check failed: ${JSON.stringify(feedback)} - ${e?.message ?? e} ${e?.stack}`)
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

	updateStatus(status: InstanceStatus, message?: string | null): void {
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

	log(level: LogLevel, message: string): void {
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
