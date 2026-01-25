import LogController, { type Logger } from '../../Log/Controller.js'
import { IpcWrapper, type IpcEventHandlers } from '../Common/IpcWrapper.js'
import semver from 'semver'
import type express from 'express'
import type {
	LogMessageMessage,
	SetStatusMessage,
	SetActionDefinitionsMessage,
	SetFeedbackDefinitionsMessage,
	UpdateFeedbackValuesMessage,
	SetVariableValuesMessage,
	SetVariableDefinitionsMessage,
	SetPresetDefinitionsMessage,
	SaveConfigMessage,
	SendOscMessage,
	RecordActionMessage,
	SetCustomVariableMessage,
	UpdateActionInstancesMessage,
	UpdateFeedbackInstancesMessage,
	ModuleIpcWrapper,
	ModuleToHostEventsNew,
	SharedUdpSocketMessageSend,
} from './IpcTypesNew.js'
import type { InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import { assertNever, type OSCMetaArgument, type CompanionHTTPRequest, type LogLevel } from '@companion-module/base'
import {
	EntityModelType,
	type ReplaceableActionEntityModel,
	type ReplaceableFeedbackEntityModel,
	type ActionEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import {
	ConnectionEntityManager,
	type EntityManagerActionEntity,
	type EntityManagerAdapter,
	type EntityManagerFeedbackEntity,
} from './EntityManager.js'
import type { ControlEntityInstance } from '../../Controls/Entities/EntityInstance.js'
import type { ChildProcessHandlerBase } from '../ProcessManager.js'
import type {
	ConnectionChildHandlerApi,
	ConnectionChildHandlerDependencies,
	RunActionExtras,
} from './ChildHandlerApi.js'
import type { SharedUdpSocketMessageJoin, SharedUdpSocketMessageLeave } from '@companion-module/base/host-api'
import {
	exprVal,
	isExpressionOrValue,
	optionsObjectToExpressionOptions,
	type ExpressionableOptionsObject,
	type SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'

export class ConnectionChildHandlerNew implements ChildProcessHandlerBase, ConnectionChildHandlerApi {
	logger: Logger

	readonly #ipcWrapper: ModuleIpcWrapper

	readonly #deps: ConnectionChildHandlerDependencies

	readonly connectionId: string

	#hasHttpHandler = false

	hasRecordActionsHandler: boolean = false
	usesNewConfigLayout: boolean = true

	readonly #entityManager: ConnectionEntityManager

	/**
	 * Current label of the connection
	 */
	#label: string

	/**
	 * Unsubscribe listeners, for use during cleanup
	 */
	#unsubListeners: () => void

	constructor(
		deps: ConnectionChildHandlerDependencies,
		monitor: RespawnMonitor,
		connectionId: string,
		apiVersion0: string,
		onRegister: (verificationToken: string) => Promise<void>
	) {
		this.logger = LogController.createLogger(`Instance/Connection/${connectionId}`)

		const apiVersion = semver.parse(apiVersion0)
		if (!apiVersion) throw new Error(`Failed to parse apiVersion "${apiVersion0}"`)

		this.#deps = deps

		this.connectionId = connectionId
		this.#label = connectionId // Give a default label until init is called

		const funcs: IpcEventHandlers<ModuleToHostEventsNew> = {
			register: async (msg) => {
				// Call back to ProcessManager to handle registration
				await onRegister(msg.verificationToken)

				return {
					connectionId: this.connectionId,
				}
			},
			'log-message': this.#handleLogMessage.bind(this),
			'set-status': this.#handleSetStatus.bind(this),
			setActionDefinitions: this.#handleSetActionDefinitions.bind(this),
			setFeedbackDefinitions: this.#handleSetFeedbackDefinitions.bind(this),
			setVariableDefinitions: this.#handleSetVariableDefinitions.bind(this),
			setPresetDefinitions: this.#handleSetPresetDefinitions.bind(this),
			setVariableValues: this.#handleSetVariableValues.bind(this),
			updateFeedbackValues: this.#handleUpdateFeedbackValues.bind(this),
			saveConfig: this.#handleSaveConfig.bind(this),
			'send-osc': this.#handleSendOsc.bind(this),
			recordAction: this.#handleRecordAction.bind(this),
			setCustomVariable: this.#handleSetCustomVariable.bind(this),
			sharedUdpSocketJoin: this.#handleSharedUdpSocketJoin.bind(this),
			sharedUdpSocketLeave: this.#handleSharedUdpSocketLeave.bind(this),
			sharedUdpSocketSend: this.#handleSharedUdpSocketSend.bind(this),
		}

		this.#ipcWrapper = new IpcWrapper(
			funcs,
			(msg) => {
				if (monitor.child) {
					monitor.child.send(msg)
				} else {
					this.logger.debug(`Child is not running, unable to send message: ${JSON.stringify(msg)}`)
				}
			},
			5000
		)

		this.#entityManager = new ConnectionEntityManager(
			new ConnectionNewEntityManagerAdapter(this.#ipcWrapper),
			this.#deps.controls,
			this.connectionId
		)

		const messageHandler = (msg: any) => {
			this.#ipcWrapper.receivedMessage(msg)
		}
		monitor.on('message', messageHandler)

		this.#unsubListeners = () => {
			monitor.off('message', messageHandler)
		}
	}

	/**
	 * Initialise the instance class running in the child process
	 */
	async init(config: InstanceConfig): Promise<void> {
		this.logger = LogController.createLogger(`Instance/Connection/${config.label}`)
		this.#label = config.label

		// Ensure each entity knows its upgradeIndex
		const allControls = this.#deps.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			if (!control.supportsEntities) continue

			for (const entity of control.entities.getAllEntities()) {
				if (entity.connectionId !== this.connectionId) continue

				if (entity.upgradeIndex === undefined) {
					entity.setMissingUpgradeIndex(config.lastUpgradeIndex)
				}

				this.#entityManager.trackEntity(entity, controlId)
			}
		}

		const msg = await this.#ipcWrapper.sendWithCb(
			'init',
			{
				label: config.label,
				isFirstInit: config.isFirstInit,
				config: config.config,
				secrets: config.secrets,

				lastUpgradeIndex: config.lastUpgradeIndex,
			},
			undefined,
			10000 // Allow more time before timeout, as init is likely to have a lot to do or high cpu contention
		)

		// Save the resulting values
		this.#hasHttpHandler = !!msg.hasHttpHandler
		this.hasRecordActionsHandler = !!msg.hasRecordActionsHandler
		this.usesNewConfigLayout = !msg.disableNewConfigLayout
		config.lastUpgradeIndex = msg.newUpgradeIndex
		this.#deps.setConnectionConfig(this.connectionId, msg.updatedConfig, msg.updatedSecrets, msg.newUpgradeIndex)

		this.#entityManager.start(config.lastUpgradeIndex)

		// Inform action recorder
		this.#deps.controls.actionRecorder.connectionAvailabilityChange(this.connectionId, true)
	}

	/**
	 * Forward an updated config object to the instance class
	 */
	async updateConfigAndLabel(config: InstanceConfig): Promise<void> {
		this.logger = LogController.createLogger(`Instance/Connection/${config.label}`)
		this.#label = config.label

		await this.#ipcWrapper.sendWithCb('updateConfig', {
			config: config.config,
			secrets: config.secrets,
			label: config.label,
		})
	}

	/**
	 * Fetch the config fields from the instance to show in the ui
	 */
	async requestConfigFields(): Promise<SomeCompanionInputField[]> {
		try {
			const res = await this.#ipcWrapper.sendWithCb('getConfigFields', {})
			return res.fields
		} catch (e) {
			this.logger.warn('Error getting config fields: ' + stringifyError(e))
			this.#sendToModuleLog('error', 'Error getting config fields: ' + stringifyError(e))

			throw e
		}
	}

	/**
	 * Send all feedback instances to the child process
	 * @access public - needs to be re-run when the topbar setting changes
	 */
	async sendAllFeedbackInstances(): Promise<void> {
		this.#entityManager.resendFeedbacks()
	}

	/**
	 * Send the list of changed variables to the child process
	 * @access public - called whenever variables change
	 */
	async sendVariablesChanged(
		changedVariableIdSet: ReadonlySet<string>,
		_changedVariableIds: string[],
		fromControlId: string | null
	): Promise<void> {
		this.#entityManager.onVariablesChanged(changedVariableIdSet, fromControlId)
	}

	async entityUpdate(entity: ControlEntityInstance, controlId: string): Promise<void> {
		if (entity.connectionId !== this.connectionId) throw new Error(`Feedback is for a different connection`)
		if (entity.disabled) return

		this.#entityManager.trackEntity(entity, controlId)
	}

	/**
	 *
	 */
	async entityLearnValues(
		entity: SomeEntityModel,
		controlId: string
	): Promise<ExpressionableOptionsObject | undefined | void> {
		if (entity.connectionId !== this.connectionId) throw new Error(`Entity is for a different connection`)

		const entityDefinition = this.#deps.instanceDefinitions.getEntityDefinition(
			entity.type,
			this.connectionId,
			entity.definitionId
		)
		if (!entityDefinition) {
			this.logger.warn(`Cannot learn values for unknown entity definition ${entity.definitionId}`)
			return undefined
		}
		const learnTimeout = entityDefinition.learnTimeout

		const parser = this.#deps.controls.createVariablesAndExpressionParser(controlId, null)
		const { parsedOptions } = parser.parseEntityOptions(entityDefinition, entity.options)

		try {
			switch (entity.type) {
				case EntityModelType.Action: {
					const msg = await this.#ipcWrapper.sendWithCb(
						'learnAction',
						{
							action: {
								id: entity.id,
								controlId: controlId,
								actionId: entity.definitionId,
								options: parsedOptions,

								upgradeIndex: null,
								disabled: !!entity.disabled,
							},
						},
						undefined,
						learnTimeout
					)

					if (!msg.options) return undefined

					return {
						...entity.options,
						...optionsObjectToExpressionOptions(msg.options, false),
					}
				}
				case EntityModelType.Feedback: {
					const control = this.#deps.controls.getControl(controlId)

					const msg = await this.#ipcWrapper.sendWithCb(
						'learnFeedback',
						{
							feedback: {
								id: entity.id,
								controlId: controlId,
								feedbackId: entity.definitionId,
								options: parsedOptions,

								image: control?.getBitmapSize() ?? undefined,

								upgradeIndex: null,
								disabled: !!entity.disabled,
							},
						},
						undefined,
						learnTimeout
					)

					if (!msg.options) return undefined

					return {
						...entity.options,
						...optionsObjectToExpressionOptions(msg.options, false),
					}
				}
				default:
					assertNever(entity)
					break
			}
		} catch (e) {
			this.logger.warn('Error learning options: ' + stringifyError(e))
			this.#sendToModuleLog('error', 'Error learning options: ' + stringifyError(e))
		}
	}

	/**
	 * Inform the child instance class about an entity that has been deleted
	 */
	async entityDelete(oldEntity: SomeEntityModel): Promise<void> {
		this.#entityManager.forgetEntity(oldEntity.id)
	}

	/**
	 * Tell the child instance class to execute an action
	 */
	async actionRun(action: ActionEntityModel, extras: RunActionExtras): Promise<void> {
		if (action.connectionId !== this.connectionId) throw new Error(`Action is for a different connection`)

		try {
			// This means the new flow is being done, and the options must be parsed at this stage
			const actionDefinition = this.#deps.instanceDefinitions.getEntityDefinition(
				EntityModelType.Action,
				this.connectionId,
				action.definitionId
			)
			if (!actionDefinition) throw new Error(`Failed to find action definition for ${action.definitionId}`)

			// Note: for actions, this doesn't need to be reactive
			const parser = this.#deps.controls.createVariablesAndExpressionParser(extras.controlId, null)
			const actionOptions = parser.parseEntityOptions(actionDefinition, action.options).parsedOptions

			const result = await this.#ipcWrapper.sendWithCb('executeAction', {
				action: {
					id: action.id,
					controlId: extras?.controlId,
					actionId: action.definitionId,
					options: actionOptions,

					upgradeIndex: null,
					disabled: !!action.disabled,
				},

				surfaceId: extras?.surfaceId,
			})
			if (result && !result.success) {
				const message = result.errorMessage || 'Unknown error'
				this.logger.warn(`Error executing action: ${message}`)
				this.#sendToModuleLog('error', `Error executing action: ${message}`)
			}
		} catch (e) {
			this.logger.warn(`Error executing action: ${stringifyError(e)}`)
			this.#sendToModuleLog('error', `Error executing action: ${stringifyError(e)}`)

			throw e
		}
	}

	/**
	 * Tell the child instance class to 'destroy' itself
	 */
	async destroy(): Promise<void> {
		// Cleanup the system once the module is destroyed

		try {
			await this.#ipcWrapper.sendWithCb('destroy', {})
		} catch (e) {
			console.warn(`Destroy for "${this.connectionId}" errored: ${e}`)
		}

		// Stop ipc commands being received
		this.#unsubListeners()

		// Cleanup any db collections
		// Future: for use in refactoring
		this.cleanup()
	}

	/**
	 * Perform any cleanup
	 */
	cleanup(): void {
		this.#deps.controls.actionRecorder.connectionAvailabilityChange(this.connectionId, false)
		this.#deps.sharedUdpManager.leaveAllFromOwner(this.connectionId)

		this.#entityManager.destroy()

		this.#deps.instanceDefinitions.forgetConnection(this.connectionId)
		this.#deps.variables.values.forgetConnection(this.connectionId, this.#label)
		this.#deps.variables.definitions.forgetConnection(this.connectionId, this.#label)
		this.#deps.controls.clearConnectionState(this.connectionId)
	}

	/**
	 *
	 */
	executeHttpRequest(req: express.Request, res: express.Response): void {
		if (this.#hasHttpHandler) {
			const requestData: CompanionHTTPRequest = {
				baseUrl: req.baseUrl,
				body: req.body,
				// @ts-expect-error TODO not in types
				headers: req.headers,
				hostname: req.hostname,
				// @ts-expect-error TODO not in types
				ip: req.ip,
				method: req.method,
				originalUrl: req.originalUrl,
				path: req.path,
				// @ts-expect-error TODO not in types
				query: req.query,
			}

			const timeoutMessage = 'handleHttpRequest timeout'

			this.#ipcWrapper
				.sendWithCb(
					'handleHttpRequest',
					{
						request: requestData,
					},
					() => new Error(timeoutMessage)
				)
				.then((msg) => {
					res.status(msg.response.status ?? 200)
					res.set(msg.response.headers ?? {})
					res.send(msg.response.body ?? '')
				})
				.catch((err) => {
					if (err.message.endsWith(timeoutMessage)) {
						res.status(504).send(JSON.stringify({ status: 504, message: 'Gateway Timeout' }))
					} else {
						res.status(500).send(JSON.stringify({ status: 500, message: 'Internal Server Error' }))
					}
				})
		} else {
			res.status(404).send(JSON.stringify({ status: 404, message: 'Not Found' }))
		}
	}

	/**
	 * Handle a log message from the child process
	 */
	async #handleLogMessage(msg: LogMessageMessage): Promise<void> {
		if (msg.level === 'error' || msg.level === 'warn' || msg.level === 'info') {
			// Ignore debug from modules in main log
			this.logger.log({
				source: msg.source ? `${this.logger.source}/${msg.source}` : this.logger.source,
				level: msg.level,
				message: msg.message,
			})
		}

		// Send everything to the 'debug' page
		this.#deps.debugLogLine(this.connectionId, msg.time, msg.source || '/', msg.level, msg.message.toString())
	}

	/**
	 * Send a message to the module 'debug' log page
	 */
	#sendToModuleLog(level: LogLevel | 'system', message: string): void {
		this.#deps.debugLogLine(this.connectionId, Date.now(), 'Module', level, message)
	}

	/**
	 * Handle updating instance status from the child process
	 */
	async #handleSetStatus(msg: SetStatusMessage): Promise<void> {
		// this.logger.silly(`Updating status`)

		this.#deps.instanceStatus.updateInstanceStatus(this.connectionId, msg.status, msg.message)

		this.#sendToModuleLog('system', `Status: ${msg.status} - ${msg.message}`)
	}

	/**
	 * Handle settings action definitions from the child process
	 */
	async #handleSetActionDefinitions(msg: SetActionDefinitionsMessage): Promise<void> {
		this.#sendToModuleLog('debug', `Updating action definitions (${Object.keys(msg.actions).length} actions)`)

		this.#deps.instanceDefinitions.setActionDefinitions(this.connectionId, msg.actions)
		this.#entityManager.onEntityDefinitionsChanged(EntityModelType.Action)
	}

	/**
	 * Handle settings feedback definitions from the child process
	 */
	async #handleSetFeedbackDefinitions(msg: SetFeedbackDefinitionsMessage): Promise<void> {
		this.#sendToModuleLog('debug', `Updating feedback definitions (${Object.keys(msg.feedbacks).length} feedbacks)`)

		this.#deps.instanceDefinitions.setFeedbackDefinitions(this.connectionId, msg.feedbacks)
		this.#entityManager.onEntityDefinitionsChanged(EntityModelType.Feedback)
	}

	/**
	 * Handle updating feedback values from the child process
	 */
	async #handleUpdateFeedbackValues(msg: UpdateFeedbackValuesMessage): Promise<void> {
		this.#deps.controls.updateFeedbackValues(
			this.connectionId,
			msg.values.map((val) => ({
				entityId: val.id,
				controlId: val.controlId,
				value: val.value,
			}))
		)
	}

	/**
	 * Handle updating variable values from the child process
	 */
	async #handleSetVariableValues(msg: SetVariableValuesMessage): Promise<void> {
		if (!this.#label) throw new Error(`Got call to handleSetVariableValues before init was called`)

		this.#deps.variables.values.setVariableValues(this.#label, msg.newValues)
	}

	/**
	 * Handle setting variable definitions from the child process
	 */
	async #handleSetVariableDefinitions(msg: SetVariableDefinitionsMessage): Promise<void> {
		if (!this.#label) throw new Error(`Got call to handleSetVariableDefinitions before init was called`)

		this.#sendToModuleLog('debug', `Updating variable definitions (${msg.variables.length} variables)`)

		this.#deps.variables.definitions.setVariableDefinitions(this.#label, msg.variables)

		this.#deps.variables.values.setVariableValues(this.#label, msg.newValues)
	}

	/**
	 * Handle setting preset definitions from the child process
	 */
	async #handleSetPresetDefinitions(msg: SetPresetDefinitionsMessage): Promise<void> {
		try {
			if (!this.#label) throw new Error(`Got call to handleSetPresetDefinitions before init was called`)

			this.#deps.instanceDefinitions.setPresetDefinitions(this.connectionId, msg.presets)
		} catch (e) {
			this.logger.error(`setPresetDefinitions: ${e}`)

			throw new Error(`Failed to set Preset Definitions: ${e}`)
		}
	}

	/**
	 * Handle saving an updated config and/or secrets object from the child process
	 */
	async #handleSaveConfig(msg: SaveConfigMessage): Promise<void> {
		// Save config and secrets, but do not automatically call this module's updateConfig again
		this.#deps.setConnectionConfig(this.connectionId, msg.config || null, msg.secrets || null, null)
	}

	/**
	 * Handle sending an osc message from the child process
	 */
	async #handleSendOsc(msg: SendOscMessage): Promise<void> {
		const decodedArgs: OSCMetaArgument[] = msg.args.map((arg) => {
			if (arg.type === 'b') {
				return { type: 'b', value: Buffer.from(arg.value, 'base64') }
			} else {
				return arg
			}
		})

		this.#deps.oscSender.send(msg.host, msg.port, msg.path, decodedArgs)
	}

	/**
	 * Handle action recorded by the instance
	 */
	async #handleRecordAction(msg: RecordActionMessage): Promise<void> {
		let delay = msg.delay || 0
		if (isNaN(delay) || delay < 0) delay = 0

		try {
			this.#deps.controls.actionRecorder.receiveAction(
				this.connectionId,
				msg.actionId,
				msg.options,
				delay,
				msg.uniquenessId ?? undefined
			)
		} catch (e) {
			this.logger.error(`Record action failed: ${e}`)
		}
	}

	/**
	 * Handle the module setting a custom variable
	 */
	async #handleSetCustomVariable(msg: SetCustomVariableMessage): Promise<void> {
		try {
			const failure = this.#deps.variables.custom.setValue(msg.customVariableId, msg.value)
			if (failure) {
				this.logger.warn(`Unable to set the value of variable $(custom:${msg.customVariableId}): ${failure}`)
			}
		} catch (e) {
			this.logger.error(`Set custom variable failed: ${e}`)
		}
	}

	/**
	 * Inform the child instance class to start or stop recording actions
	 */
	async startStopRecordingActions(recording: boolean): Promise<void> {
		if (!this.hasRecordActionsHandler) throw new Error(`Not supported by connection`)

		await this.#ipcWrapper.sendWithCb('startStopRecordActions', {
			recording: recording,
		})
	}

	/**
	 *
	 */
	async #handleSharedUdpSocketJoin(msg: SharedUdpSocketMessageJoin): Promise<string> {
		const handleId = await this.#deps.sharedUdpManager.joinPort(
			msg.family,
			msg.portNumber,
			this.connectionId,
			(message, rInfo) => {
				this.#ipcWrapper.sendWithNoCb('sharedUdpSocketMessage', {
					handleId,
					portNumber: msg.portNumber,
					message: message.toString('base64'),
					source: rInfo,
				})
			},
			(error) => {
				this.#ipcWrapper.sendWithNoCb('sharedUdpSocketError', {
					handleId,
					portNumber: msg.portNumber,
					errorMessage: error.message,
				})
			}
		)
		return handleId
	}
	/**
	 *
	 */
	async #handleSharedUdpSocketLeave(msg: SharedUdpSocketMessageLeave): Promise<void> {
		this.#deps.sharedUdpManager.leavePort(this.connectionId, msg.handleId)
	}
	/**
	 *
	 */
	async #handleSharedUdpSocketSend(msg: SharedUdpSocketMessageSend): Promise<void> {
		this.#deps.sharedUdpManager.sendOnPort(
			this.connectionId,
			msg.handleId,
			msg.address,
			msg.port,
			Buffer.from(msg.message, 'base64')
		)
	}
}

class ConnectionNewEntityManagerAdapter implements EntityManagerAdapter {
	readonly #ipcWrapper: ModuleIpcWrapper

	constructor(ipcWrapper: ModuleIpcWrapper) {
		this.#ipcWrapper = ipcWrapper
	}

	async updateActions(actions: Map<string, EntityManagerActionEntity | null>) {
		const updateMessage: UpdateActionInstancesMessage = { actions: {} }

		for (const [id, value] of actions) {
			if (value) {
				updateMessage.actions[id] = {
					id: value.entity.id,
					controlId: value.controlId,
					actionId: value.entity.definitionId,
					options: value.parsedOptions,

					upgradeIndex: value.entity.upgradeIndex ?? null,
					disabled: !!value.entity.disabled,
				}
			} else {
				updateMessage.actions[id] = null
			}
		}

		return this.#ipcWrapper.sendWithCb('updateActions', updateMessage)
	}

	async updateFeedbacks(feedbacks: Map<string, EntityManagerFeedbackEntity | null>) {
		const updateMessage: UpdateFeedbackInstancesMessage = { feedbacks: {} }

		for (const [id, value] of feedbacks) {
			if (value) {
				updateMessage.feedbacks[id] = {
					id: value.entity.id,
					controlId: value.controlId,
					feedbackId: value.entity.definitionId,
					options: value.parsedOptions,

					image: value.imageSize,

					upgradeIndex: value.entity.upgradeIndex ?? null,
					disabled: !!value.entity.disabled,
				}
			} else {
				updateMessage.feedbacks[id] = null
			}
		}

		return this.#ipcWrapper.sendWithCb('updateFeedbacks', updateMessage)
	}

	async upgradeActions(actions: Omit<EntityManagerActionEntity, 'parsedOptions'>[], currentUpgradeIndex: number) {
		return this.#ipcWrapper
			.sendWithCb('upgradeActions', {
				actions: actions.map((act) => ({
					id: act.entity.id,
					controlId: act.controlId,
					actionId: act.entity.definitionId,
					options: act.entity.options,

					upgradeIndex: act.entity.upgradeIndex ?? null,
					disabled: !!act.entity.disabled,
				})),
				defaultUpgradeIndex: 0, // Unused
			})
			.then((upgraded) => {
				return upgraded.updatedActions.map(
					(action) =>
						({
							id: action.id,
							type: EntityModelType.Action,
							definitionId: action.actionId,
							options: action.options,
							upgradeIndex: currentUpgradeIndex,
						}) satisfies ReplaceableActionEntityModel
				)
			})
	}

	async upgradeFeedbacks(feedbacks: Omit<EntityManagerFeedbackEntity, 'parsedOptions'>[], currentUpgradeIndex: number) {
		return this.#ipcWrapper
			.sendWithCb('upgradeFeedbacks', {
				feedbacks: feedbacks.map((fb) => ({
					id: fb.entity.id,
					controlId: fb.controlId,
					feedbackId: fb.entity.definitionId,
					options: fb.entity.options,

					isInverted: isExpressionOrValue(fb.entity.isInverted)
						? fb.entity.isInverted
						: exprVal(!!fb.entity.isInverted),

					upgradeIndex: fb.entity.upgradeIndex ?? null,
					disabled: !!fb.entity.disabled,
				})),
				defaultUpgradeIndex: 0, // Unused
			})
			.then((upgraded) => {
				return upgraded.updatedFeedbacks.map(
					(feedback) =>
						({
							id: feedback.id,
							type: EntityModelType.Feedback,
							definitionId: feedback.feedbackId,
							options: feedback.options,
							style: feedback.style,
							isInverted: isExpressionOrValue(feedback.isInverted)
								? feedback.isInverted
								: exprVal(!!feedback.isInverted),
							upgradeIndex: currentUpgradeIndex,
						}) satisfies ReplaceableFeedbackEntityModel
				)
			})
	}
}
