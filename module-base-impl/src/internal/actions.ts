import {
	ParseVariablesInStringMessage,
	ParseVariablesInStringResponseMessage,
	SetActionDefinitionsMessage,
	ActionInstance,
	ExecuteActionMessage,
	LearnActionMessage,
	LearnActionResponseMessage,
} from '../host-api/api'
import {
	CompanionActionContext,
	CompanionActionDefinition,
	CompanionActionDefinitions,
	CompanionActionInfo,
	CompanionFeedbackContext,
	LogLevel,
} from '@companion-module/base'
import { serializeIsVisibleFn } from './util'

function convertActionInstanceToEvent(action: ActionInstance): CompanionActionInfo {
	return {
		id: action.id,
		actionId: action.actionId,
		controlId: action.controlId,
		options: action.options,
	}
}

export class ActionManager {
	readonly #parseVariablesInString: (
		msg: ParseVariablesInStringMessage
	) => Promise<ParseVariablesInStringResponseMessage>
	readonly #setActionDefinitions: (msg: SetActionDefinitionsMessage) => void
	readonly #log: (level: LogLevel, message: string) => void

	readonly #actionDefinitions = new Map<string, CompanionActionDefinition>()
	readonly #actionInstances = new Map<string, ActionInstance>()

	constructor(
		parseVariablesInString: (msg: ParseVariablesInStringMessage) => Promise<ParseVariablesInStringResponseMessage>,
		setActionDefinitions: (msg: SetActionDefinitionsMessage) => void,
		log: (level: LogLevel, message: string) => void
	) {
		this.#parseVariablesInString = parseVariablesInString
		this.#setActionDefinitions = setActionDefinitions
		this.#log = log
	}

	public async handleExecuteAction(msg: ExecuteActionMessage): Promise<void> {
		const actionDefinition = this.#actionDefinitions.get(msg.action.actionId)
		if (!actionDefinition) throw new Error(`Unknown action: ${msg.action.actionId}`)

		const context: CompanionActionContext = {
			parseVariablesInString: async (text: string): Promise<string> => {
				const res = await this.#parseVariablesInString({
					text: text,
					controlId: msg.action.controlId,
					actionInstanceId: msg.action.id,
					feedbackInstanceId: undefined,
				})

				return res.text
			},
		}

		await actionDefinition.callback(
			{
				id: msg.action.id,
				actionId: msg.action.actionId,
				controlId: msg.action.controlId,
				options: msg.action.options,

				_deviceId: msg.deviceId,
				_page: msg.action.page,
				_bank: msg.action.bank,
			},
			context
		)
	}

	public handleUpdateActions(actions: { [id: string]: ActionInstance | null | undefined }): void {
		for (const [id, action] of Object.entries(actions)) {
			const existing = this.#actionInstances.get(id)
			if (existing) {
				// Call unsubscribe
				const definition = this.#actionDefinitions.get(existing.actionId)
				if (definition?.unsubscribe) {
					const context: CompanionActionContext = {
						parseVariablesInString: async (text: string): Promise<string> => {
							const res = await this.#parseVariablesInString({
								text: text,
								controlId: existing.controlId,
								actionInstanceId: existing.id,
								feedbackInstanceId: undefined,
							})

							return res.text
						},
					}

					Promise.resolve(definition.unsubscribe(convertActionInstanceToEvent(existing), context)).catch((e) => {
						this.#log(
							'error',
							`Action unsubscribe failed: ${JSON.stringify(existing)} - ${e?.message ?? e} ${e?.stack}`
						)
					})
				}
			}

			if (!action || action.disabled) {
				// Deleted
				this.#actionInstances.delete(id)
			} else {
				// TODO module-lib - deep freeze the action to avoid mutation?
				this.#actionInstances.set(id, action)

				// Inserted or updated
				const definition = this.#actionDefinitions.get(action.actionId)
				if (definition?.subscribe) {
					const context: CompanionFeedbackContext = {
						parseVariablesInString: async (text: string): Promise<string> => {
							const res = await this.#parseVariablesInString({
								text: text,
								controlId: action.controlId,
								actionInstanceId: action.id,
								feedbackInstanceId: undefined,
							})

							return res.text
						},
					}

					Promise.resolve(definition.subscribe(convertActionInstanceToEvent(action), context)).catch((e) => {
						this.#log('error', `Action subscribe failed: ${JSON.stringify(action)} - ${e?.message ?? e} ${e?.stack}`)
					})
				}
			}
		}
	}

	public async handleLearnAction(msg: LearnActionMessage): Promise<LearnActionResponseMessage> {
		const definition = this.#actionDefinitions.get(msg.action.actionId)
		if (definition && definition.learn) {
			const context: CompanionFeedbackContext = {
				parseVariablesInString: async (text: string): Promise<string> => {
					const res = await this.#parseVariablesInString({
						text: text,
						controlId: msg.action.controlId,
						actionInstanceId: msg.action.id,
						feedbackInstanceId: undefined,
					})

					return res.text
				},
			}

			const newOptions = await definition.learn(
				{
					id: msg.action.id,
					actionId: msg.action.actionId,
					controlId: msg.action.controlId,
					options: msg.action.options,

					_deviceId: undefined,
					_page: msg.action.page,
					_bank: msg.action.bank,
				},
				context
			)

			return {
				options: newOptions,
			}
		} else {
			// Not supported
			return {
				options: undefined,
			}
		}
	}

	setActionDefinitions(actions: CompanionActionDefinitions): void {
		const hostActions: SetActionDefinitionsMessage['actions'] = []

		this.#actionDefinitions.clear()

		for (const [actionId, action] of Object.entries(actions)) {
			if (action) {
				hostActions.push({
					id: actionId,
					name: action.name,
					description: action.description,
					options: serializeIsVisibleFn(action.options),
					hasLearn: !!action.learn,
				})

				// Remember the definition locally
				this.#actionDefinitions.set(actionId, action)
			}
		}

		this.#setActionDefinitions({ actions: hostActions })
	}

	/** @deprecated */
	_getAllActions(): Pick<ActionInstance, 'id' | 'actionId' | 'controlId' | 'options'>[] {
		return Array.from(this.#actionInstances.values()).map((act) => ({
			id: act.id,
			actionId: act.actionId,
			controlId: act.controlId,
			options: act.options,
		}))
	}

	subscribeActions(actionIds: string[]): void {
		let actions = Array.from(this.#actionInstances.values())

		const actionIdSet = new Set(actionIds)
		if (actionIdSet.size) actions = actions.filter((fb) => actionIdSet.has(fb.actionId))

		for (const act of actions) {
			const def = this.#actionDefinitions.get(act.actionId)
			if (def?.subscribe) {
				const context: CompanionActionContext = {
					parseVariablesInString: async (text: string): Promise<string> => {
						const res = await this.#parseVariablesInString({
							text: text,
							controlId: act.controlId,
							actionInstanceId: act.id,
							feedbackInstanceId: undefined,
						})

						return res.text
					},
				}

				Promise.resolve(def.subscribe(convertActionInstanceToEvent(act), context)).catch((e) => {
					this.#log('error', `Action subscribe failed: ${JSON.stringify(act)} - ${e?.message ?? e} ${e?.stack}`)
				})
			}
		}
	}

	unsubscribeActions(actionIds: string[]): void {
		let actions = Array.from(this.#actionInstances.values())

		const actionIdSet = new Set(actionIds)
		if (actionIdSet.size) actions = actions.filter((fb) => actionIdSet.has(fb.actionId))

		for (const act of actions) {
			const def = this.#actionDefinitions.get(act.actionId)
			if (def && def.unsubscribe) {
				const context: CompanionActionContext = {
					parseVariablesInString: async (text: string): Promise<string> => {
						const res = await this.#parseVariablesInString({
							text: text,
							controlId: act.controlId,
							actionInstanceId: act.id,
							feedbackInstanceId: undefined,
						})

						return res.text
					},
				}

				Promise.resolve(def.unsubscribe(convertActionInstanceToEvent(act), context)).catch((e) => {
					this.#log('error', `Action unsubscribe failed: ${JSON.stringify(act)} - ${e?.message ?? e} ${e?.stack}`)
				})
			}
		}
	}
}
