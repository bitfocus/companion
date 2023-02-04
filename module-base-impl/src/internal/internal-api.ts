import {
	CompanionPresetDefinitions,
	CompanionVariableDefinition,
	CompanionVariableValues,
	CompanionVariableValue,
	CompanionActionInfo,
	OSCSomeArguments,
	InstanceStatus,
	LogLevel,
	literal,
	InstanceBase,
	CompanionStaticUpgradeScript,
} from '@companion-module/base'
import { CompanionInstanceApi, InstanceBaseOptions } from '@companion-module/base/dist/internal/newapi'
import {
	ExecuteActionMessage,
	GetConfigFieldsMessage,
	GetConfigFieldsResponseMessage,
	HandleHttpRequestMessage,
	HandleHttpRequestResponseMessage,
	HostToModuleEventsV0,
	InitMessage,
	InitResponseMessage,
	LearnActionMessage,
	LearnActionResponseMessage,
	LearnFeedbackMessage,
	LearnFeedbackResponseMessage,
	LogMessageMessage,
	ModuleToHostEventsV0,
	SendOscMessage,
	SetPresetDefinitionsMessage,
	SetStatusMessage,
	SetVariableDefinitionsMessage,
	SetVariableValuesMessage,
	StartStopRecordActionsMessage,
	UpdateActionInstancesMessage,
	UpdateFeedbackInstancesMessage,
	VariablesChangedMessage,
} from '../host-api/api'
import { IpcWrapper } from '../host-api/ipc-wrapper'
import { ActionManager } from './actions'
import { FeedbackManager } from './feedback'
import PQueue from 'p-queue'
import { serializeIsVisibleFn } from './util'
import { runThroughUpgradeScripts } from './upgrade'

export class CompanionInstanceApiImpl<TConfig> implements CompanionInstanceApi<TConfig> {
	readonly connectionId: string
	#instance: InstanceBase<TConfig> | undefined

	readonly #ipcWrapper: IpcWrapper<ModuleToHostEventsV0, HostToModuleEventsV0>
	readonly #upgradeScripts: CompanionStaticUpgradeScript<TConfig>[]

	readonly #lifecycleQueue: PQueue = new PQueue({ concurrency: 1 })
	#initialized = false
	#recordingActions = false

	readonly actionManager: ActionManager
	readonly feedbackManager: FeedbackManager

	readonly #variableDefinitions = new Map<string, CompanionVariableDefinition>()
	readonly #variableValues = new Map<string, CompanionVariableValue>()

	readonly instanceOptions: InstanceBaseOptions

	constructor(connectionId: string, upgradeScripts: CompanionStaticUpgradeScript<TConfig>[]) {
		this.connectionId = connectionId
		this.#upgradeScripts = upgradeScripts

		this.#ipcWrapper = new IpcWrapper<ModuleToHostEventsV0, HostToModuleEventsV0>(
			{
				init: this._handleInit.bind(this),
				destroy: this._handleDestroy.bind(this),
				updateConfig: this._handleConfigUpdate.bind(this),
				executeAction: this._handleExecuteAction.bind(this),
				updateFeedbacks: this._handleUpdateFeedbacks.bind(this),
				updateActions: this._handleUpdateActions.bind(this),
				getConfigFields: this._handleGetConfigFields.bind(this),
				handleHttpRequest: this._handleHttpRequest.bind(this),
				learnAction: this._handleLearnAction.bind(this),
				learnFeedback: this._handleLearnFeedback.bind(this),
				startStopRecordActions: this._handleStartStopRecordActions.bind(this),
				variablesChanged: this._handleVariablesChanged.bind(this),
			},
			(msg) => {
				process.send!(msg)
			},
			5000
		)
		process.on('message', (msg) => {
			this.#ipcWrapper.receivedMessage(msg as any)
		})

		this.instanceOptions = {
			disableVariableValidation: false,
		}

		this.actionManager = new ActionManager(
			async (msg) => this.#ipcWrapper.sendWithCb('parseVariablesInString', msg),
			(msg) => this.#ipcWrapper.sendWithNoCb('setActionDefinitions', msg),
			this.log.bind(this)
		)
		this.feedbackManager = new FeedbackManager(
			async (msg) => this.#ipcWrapper.sendWithCb('parseVariablesInString', msg),
			(msg) => this.#ipcWrapper.sendWithNoCb('updateFeedbackValues', msg),
			(msg) => this.#ipcWrapper.sendWithNoCb('setFeedbackDefinitions', msg),
			this.log.bind(this)
		)
	}

	public setInstance(instance: InstanceBase<TConfig>): void {
		this.#instance = instance
	}

	private async _handleInit(msg: InitMessage): Promise<InitResponseMessage> {
		if (!this.#instance) throw new Error('Instance is not setup correctly')

		return this.#lifecycleQueue.add(async () => {
			if (!this.#instance) throw new Error('Instance is not setup correctly')
			if (this.#initialized) throw new Error('Already initialized')

			const actions = msg.actions
			const feedbacks = msg.feedbacks
			let config = msg.config as TConfig

			// Create initial config object
			if (msg.isFirstInit) {
				const newConfig: any = {}
				const fields = this.#instance.getConfigFields()
				for (const field of fields) {
					if ('default' in field) {
						newConfig[field.id] = field.default
					}
				}
				config = newConfig as TConfig
				this.saveConfig(config)
			}

			/**
			 * Performing upgrades during init requires a fair chunk of work.
			 * Some actions/feedbacks will be using the upgradeIndex of the instance, but some may have their own upgradeIndex on themselves if they are from an import.
			 */
			const { updatedActions, updatedFeedbacks, updatedConfig } = runThroughUpgradeScripts(
				actions,
				feedbacks,
				msg.lastUpgradeIndex,
				this.#upgradeScripts,
				config
			)
			config = (updatedConfig as TConfig | undefined) ?? config

			// Send the upgraded data back to companion now. Just so that if the init crashes, this doesnt have to be repeated
			const pSendUpgrade = this.#ipcWrapper.sendWithCb('upgradedItems', {
				updatedActions,
				updatedFeedbacks,
			})

			// Now we can initialise the module
			try {
				await this.#instance.init(config, !!msg.isFirstInit)

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
				this._handleUpdateActions({ actions }, true).catch((e) => {
					this.log('error', `Receive actions failed: ${e}`)
				})
				this._handleUpdateFeedbacks({ feedbacks }, true).catch((e) => {
					this.log('error', `Receive feedbacks failed: ${e}`)
				})
			})

			return {
				hasHttpHandler: typeof this.#instance.handleHttpRequest === 'function',
				hasRecordActionsHandler: typeof this.#instance.handleStartStopRecordActions == 'function',
				newUpgradeIndex: this.#upgradeScripts.length - 1,
				updatedConfig: config,
			}
		})
	}
	private async _handleDestroy(): Promise<void> {
		await this.#lifecycleQueue.add(async () => {
			if (!this.#instance) throw new Error('Instance is not setup correctly')
			if (!this.#initialized) throw new Error('Not initialized')

			await this.#instance.destroy()

			this.#initialized = false
		})
	}
	private async _handleConfigUpdate(config: unknown): Promise<void> {
		await this.#lifecycleQueue.add(async () => {
			if (!this.#instance) throw new Error('Instance is not setup correctly')
			if (!this.#initialized) throw new Error('Not initialized')

			await this.#instance.configUpdated(config as TConfig)
		})
	}
	private async _handleExecuteAction(msg: ExecuteActionMessage): Promise<void> {
		return this.actionManager.handleExecuteAction(msg)
	}

	private async _handleUpdateFeedbacks(msg: UpdateFeedbackInstancesMessage, skipUpgrades?: boolean): Promise<void> {
		// Run through upgrade scripts if needed
		if (!skipUpgrades) {
			const res = runThroughUpgradeScripts({}, msg.feedbacks, null, this.#upgradeScripts, undefined)
			this.#ipcWrapper
				.sendWithCb('upgradedItems', {
					updatedActions: res.updatedActions,
					updatedFeedbacks: res.updatedFeedbacks,
				})
				.catch((e) => {
					this.log('error', `Failed to save upgraded feedbacks: ${e}`)
				})
		}

		this.feedbackManager.handleUpdateFeedbacks(msg.feedbacks)
	}
	private async _handleUpdateActions(msg: UpdateActionInstancesMessage, skipUpgrades?: boolean): Promise<void> {
		// Run through upgrade scripts if needed
		if (!skipUpgrades) {
			const res = runThroughUpgradeScripts(msg.actions, {}, null, this.#upgradeScripts, undefined)
			this.#ipcWrapper
				.sendWithCb('upgradedItems', {
					updatedActions: res.updatedActions,
					updatedFeedbacks: res.updatedFeedbacks,
				})
				.catch((e) => {
					this.log('error', `Failed to save upgraded actions: ${e}`)
				})
		}

		this.actionManager.handleUpdateActions(msg.actions)
	}

	private async _handleGetConfigFields(_msg: GetConfigFieldsMessage): Promise<GetConfigFieldsResponseMessage> {
		if (!this.#instance) throw new Error('Instance is not setup correctly')
		return {
			fields: serializeIsVisibleFn(this.#instance.getConfigFields()),
		}
	}

	private async _handleHttpRequest(msg: HandleHttpRequestMessage): Promise<HandleHttpRequestResponseMessage> {
		if (!this.#instance) throw new Error('Instance is not setup correctly')
		if (!this.#instance.handleHttpRequest) throw new Error(`handleHttpRequest is not supported!`)

		const res = await this.#instance.handleHttpRequest(msg.request)

		return { response: res }
	}
	private async _handleLearnAction(msg: LearnActionMessage): Promise<LearnActionResponseMessage> {
		return this.actionManager.handleLearnAction(msg)
	}
	private async _handleLearnFeedback(msg: LearnFeedbackMessage): Promise<LearnFeedbackResponseMessage> {
		return this.feedbackManager.handleLearnFeedback(msg)
	}
	private async _handleStartStopRecordActions(msg: StartStopRecordActionsMessage): Promise<void> {
		if (!this.#instance) throw new Error('Instance is not setup correctly')

		if (!msg.recording) {
			if (!this.#recordingActions) {
				// Already stopped
				return
			}
		} else {
			if (this.#recordingActions) {
				// Already running
				return
			}
		}

		if (!this.#instance.handleStartStopRecordActions) {
			this.#recordingActions = false
			throw new Error('Recording actions is not supported by this module!')
		}

		this.#recordingActions = msg.recording

		this.#instance.handleStartStopRecordActions(this.#recordingActions)
	}

	private async _handleVariablesChanged(msg: VariablesChangedMessage): Promise<void> {
		this.feedbackManager.handleVariablesChanged(msg)
	}

	saveConfig(newConfig: TConfig): void {
		this.#ipcWrapper.sendWithNoCb('saveConfig', { config: newConfig })
	}
	setPresetDefinitions(presets: CompanionPresetDefinitions): void {
		const hostPresets: SetPresetDefinitionsMessage['presets'] = []

		for (const [id, preset] of Object.entries(presets)) {
			if (preset) {
				hostPresets.push({
					...preset,
					id,
				})
			}
		}

		this.#ipcWrapper.sendWithNoCb('setPresetDefinitions', { presets: hostPresets })
	}
	setVariableDefinitions(variables: CompanionVariableDefinition[]): void {
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

		if (!this.instanceOptions.disableVariableValidation) {
			const validIds = new Set(this.#variableDefinitions.keys())
			for (const id of this.#variableValues.keys()) {
				if (!validIds.has(id)) {
					// Delete any local cached value
					this.#variableValues.delete(id)
				}
			}
		}

		this.#ipcWrapper.sendWithNoCb('setVariableDefinitions', { variables: hostVariables })
	}
	setVariableValues(values: CompanionVariableValues): void {
		const hostValues: SetVariableValuesMessage['newValues'] = []

		for (const [variableId, value] of Object.entries(values)) {
			if (this.instanceOptions.disableVariableValidation) {
				// update the cached value
				if (value === undefined) {
					this.#variableValues.delete(variableId)
				} else {
					this.#variableValues.set(variableId, value)
				}

				hostValues.push({
					id: variableId,
					value: value,
				})
			} else if (this.#variableDefinitions.has(variableId)) {
				// update the cached value
				this.#variableValues.set(variableId, value ?? '')

				hostValues.push({
					id: variableId,
					value: value ?? '',
				})
			} else {
				// tell companion to delete the value
				hostValues.push({
					id: variableId,
					value: undefined,
				})
			}
		}

		this.#ipcWrapper.sendWithNoCb('setVariableValues', { newValues: hostValues })
	}
	getVariableValue(variableId: string): CompanionVariableValue | undefined {
		return this.#variableValues.get(variableId)
	}
	async parseVariablesInString(text: string): Promise<string> {
		const currentContext = this.feedbackManager.parseVariablesContext
		if (currentContext) {
			this.log(
				'debug',
				`parseVariablesInString called while in: ${currentContext}. You should use the parseVariablesInString provided to the callback instead`
			)
		}

		const res = await this.#ipcWrapper.sendWithCb('parseVariablesInString', {
			text: text,
			controlId: undefined,
			actionInstanceId: undefined,
			feedbackInstanceId: undefined,
		})
		return res.text
	}
	recordAction(action: Omit<CompanionActionInfo, 'id' | 'controlId'>, uniquenessId?: string | undefined): void {
		if (!this.#recordingActions) throw new Error('Not currently recording actions')

		this.#ipcWrapper.sendWithNoCb('recordAction', {
			uniquenessId: uniquenessId ?? null,
			actionId: action.actionId,
			options: action.options,
		})
	}
	setCustomVariableValue(variableName: string, value: CompanionVariableValue): void {
		this.#ipcWrapper.sendWithNoCb('setCustomVariable', {
			customVariableId: variableName,
			value,
		})
	}
	oscSend(host: string, port: number, path: string, args: OSCSomeArguments): void {
		this.#ipcWrapper.sendWithNoCb(
			'send-osc',
			literal<SendOscMessage>({
				host,
				port,
				path,
				args,
			})
		)
	}
	updateStatus(status: InstanceStatus, message?: string | null | undefined): void {
		this.#ipcWrapper.sendWithNoCb(
			'set-status',
			literal<SetStatusMessage>({
				status,
				message: message ?? null,
			})
		)
	}
	log(level: LogLevel, message: string): void {
		this.#ipcWrapper.sendWithNoCb(
			'log-message',
			literal<LogMessageMessage>({
				level,
				message,
			})
		)
	}
}
