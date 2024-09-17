import LogController, { Logger } from '../Log/Controller.js'
import { IpcEventHandlers, IpcWrapper } from '@companion-module/base/dist/host-api/ipc-wrapper.js'
import { ConnectionDebugLogRoom } from './Host.js'
import semver from 'semver'
import type express from 'express'
import type {
	ActionInstance as ModuleActionInstance,
	FeedbackInstance as ModuleFeedbackInstance,
	HostToModuleEventsV0,
	ModuleToHostEventsV0,
	SomeEncodedCompanionConfigField,
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
	ParseVariablesInStringMessage,
	ParseVariablesInStringResponseMessage,
	RecordActionMessage,
	SetCustomVariableMessage,
	UpgradedDataResponseMessage,
	SharedUdpSocketMessageJoin,
	SharedUdpSocketMessageLeave,
	SharedUdpSocketMessageSend,
} from '@companion-module/base/dist/host-api/api.js'
import type { Registry } from '../Registry.js'
import type { InstanceStatus } from './Status.js'
import type { ConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { FeedbackInstance } from '@companion-app/shared/Model/FeedbackModel.js'
import type {
	CompanionHTTPRequest,
	CompanionInputFieldBase,
	CompanionOptionValues,
	CompanionVariableValue,
	LogLevel,
} from '@companion-module/base'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ActionDefinition } from '@companion-app/shared/Model/ActionDefinitionModel.js'
import { FeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import { PresetDefinitionTmp } from './Definitions.js'

const range1_2_0OrLater = new semver.Range('>=1.2.0-0', { includePrerelease: true })

type Monitor = any // TODO

export class SocketEventsHandler {
	logger: Logger

	readonly #ipcWrapper: IpcWrapper<HostToModuleEventsV0, ModuleToHostEventsV0>

	readonly #registry: Registry

	readonly #instanceStatus: InstanceStatus

	readonly connectionId: string

	#hasHttpHandler = false

	hasRecordActionsHandler: boolean = false

	#expectsLabelUpdates: boolean = false

	/**
	 * Current label of the connection
	 */
	#label: string

	/**
	 * Unsubscribe listeners, for use during cleanup
	 */
	#unsubListeners: () => void

	constructor(
		registry: Registry,
		instanceStatus: InstanceStatus,
		monitor: Monitor,
		connectionId: string,
		apiVersion0: string
	) {
		this.logger = LogController.createLogger(`Instance/Wrapper/${connectionId}`)

		const apiVersion = semver.parse(apiVersion0)
		if (!apiVersion) throw new Error(`Failed to parse apiVersion "${apiVersion0}"`)

		this.#registry = registry
		this.#instanceStatus = instanceStatus

		this.connectionId = connectionId
		this.#expectsLabelUpdates = range1_2_0OrLater.test(apiVersion)

		const funcs: IpcEventHandlers<ModuleToHostEventsV0> = {
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
			parseVariablesInString: this.#handleParseVariablesInString.bind(this),
			upgradedItems: this.#handleUpgradedItems.bind(this),
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

		const messageHandler = (msg: any) => {
			this.#ipcWrapper.receivedMessage(msg)
		}
		monitor.child.on('message', messageHandler)

		this.#unsubListeners = () => {
			monitor.child.off('message', messageHandler)
		}
	}

	/**
	 * Initialise the instance class running in the child process
	 */
	async init(config: ConnectionConfig): Promise<void> {
		this.logger = LogController.createLogger(`Instance/Wrapper/${config.label}`)
		this.#label = config.label

		const allFeedbacks = this.#getAllFeedbackInstances()
		const allActions = this.#getAllActionInstances()

		const msg = await this.#ipcWrapper.sendWithCb(
			'init',
			{
				label: config.label,
				isFirstInit: config.isFirstInit,
				config: config.config,

				lastUpgradeIndex: config.lastUpgradeIndex,

				// Pass all actions and feedbacks for upgrading and initial subscribe calls
				actions: allActions,
				feedbacks: allFeedbacks,
			},
			undefined,
			10000 // Allow more time before timeout, as init is likely to have a lot to do or high cpu contention
		)

		// Save the resulting values
		this.#hasHttpHandler = !!msg.hasHttpHandler
		this.hasRecordActionsHandler = !!msg.hasRecordActionsHandler
		config.lastUpgradeIndex = msg.newUpgradeIndex
		this.#registry.instance.setInstanceLabelAndConfig(this.connectionId, null, msg.updatedConfig, true)
	}

	/**
	 * Forward an updated config object to the instance class
	 */
	async updateConfigAndLabel(config: unknown, label: string): Promise<void> {
		this.logger = LogController.createLogger(`Instance/Wrapper/${label}`)
		this.#label = label

		if (this.#expectsLabelUpdates) {
			await this.#ipcWrapper.sendWithCb('updateConfigAndLabel', {
				config,
				label,
			})
		} else {
			await this.#ipcWrapper.sendWithCb('updateConfig', config)
		}
	}

	/**
	 * Fetch the config fields from the instance to show in the ui
	 */
	async requestConfigFields(): Promise<SomeEncodedCompanionConfigField[]> {
		try {
			const res = await this.#ipcWrapper.sendWithCb('getConfigFields', {})
			return res.fields
		} catch (e: any) {
			this.logger.warn('Error getting config fields: ' + e?.message)
			this.#sendToModuleLog('error', 'Error getting config fields: ' + e?.message)

			throw e
		}
	}

	/**
	 * Get all the feedback instances for this instance
	 */
	#getAllFeedbackInstances(): Record<string, ModuleFeedbackInstance> {
		const allFeedbacks: Record<string, ModuleFeedbackInstance> = {}

		// Find all the feedbacks on controls
		const allControls = this.#registry.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			const controlFeedbacks =
				control.supportsFeedbacks && control.feedbacks.getFlattenedFeedbackInstances(this.connectionId)
			if (controlFeedbacks && controlFeedbacks.length > 0) {
				const imageSize = control.getBitmapSize()
				for (const feedback of controlFeedbacks) {
					allFeedbacks[feedback.id] = {
						id: feedback.id,
						controlId: controlId,
						feedbackId: feedback.type,
						options: feedback.options,

						isInverted: !!feedback.isInverted,

						upgradeIndex: feedback.upgradeIndex ?? null,
						disabled: !!feedback.disabled,

						image: imageSize ?? undefined,
					}
				}
			}
		}

		return allFeedbacks
	}

	/**
	 * Send all feedback instances to the child process
	 * @access public - needs to be re-run when the topbar setting changes
	 */
	async sendAllFeedbackInstances(): Promise<void> {
		const msg = {
			feedbacks: this.#getAllFeedbackInstances(),
		}

		await this.#ipcWrapper.sendWithCb('updateFeedbacks', msg)
	}

	/**
	 * Send the list of changed variables to the child process
	 * @access public - called whenever variables change
	 */
	async sendVariablesChanged(changedVariableIds: string[]): Promise<void> {
		// Future: only inform module of variables it parsed and should react to.
		// This will help avoid excess work when variables are not interesting to a module.

		this.#ipcWrapper.sendWithNoCb('variablesChanged', {
			variablesIds: changedVariableIds,
		})
	}

	/**
	 * Get all the action instances for this instance
	 */
	#getAllActionInstances(): Record<string, ModuleActionInstance> {
		const allActions: Record<string, ModuleActionInstance> = {}

		const allControls = this.#registry.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			if (control.supportsActions) {
				const actions = control.getAllActions()

				for (const action of actions) {
					if (action.instance == this.connectionId) {
						allActions[action.id] = {
							id: action.id,
							controlId: controlId,
							actionId: action.action,
							options: action.options,

							upgradeIndex: action.upgradeIndex ?? null,
							disabled: !!action.disabled,
						}
					}
				}
			}
		}

		return allActions
	}

	// /**
	//  * Send all action instances to the child process
	//  * @access private
	//  */
	// async #sendAllActionInstances() {
	// 	const msg = {
	// 		actions: this.#getAllActionInstances(),
	// 	}

	// 	await this.ipcWrapper.sendWithCb('updateActions', msg)
	// }

	/**
	 * Inform the child instance class about an updated feedback
	 */
	async feedbackUpdate(feedback: FeedbackInstance, controlId: string): Promise<void> {
		if (feedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a different instance`)
		if (feedback.disabled) return

		const control = this.#registry.controls.getControl(controlId)

		await this.#ipcWrapper.sendWithCb('updateFeedbacks', {
			feedbacks: {
				[feedback.id]: {
					id: feedback.id,
					controlId: controlId,
					feedbackId: feedback.type,
					options: feedback.options,

					isInverted: !!feedback.isInverted,

					image: control?.getBitmapSize() ?? undefined,

					upgradeIndex: feedback.upgradeIndex ?? null,
					disabled: !!feedback.disabled,
				},
			},
		})
	}

	/**
	 *
	 */
	async feedbackLearnValues(
		feedback: FeedbackInstance,
		controlId: string
	): Promise<CompanionOptionValues | undefined | void> {
		if (feedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a different instance`)

		const control = this.#registry.controls.getControl(controlId)

		const feedbackSpec = this.#registry.instance.definitions.getFeedbackDefinition(this.connectionId, feedback.type)
		const learnTimeout = feedbackSpec?.learnTimeout

		try {
			const msg = await this.#ipcWrapper.sendWithCb(
				'learnFeedback',
				{
					feedback: {
						id: feedback.id,
						controlId: controlId,
						feedbackId: feedback.type,
						options: feedback.options,

						isInverted: !!feedback.isInverted,

						image: control?.getBitmapSize() ?? undefined,

						upgradeIndex: null,
						disabled: !!feedback.disabled,
					},
				},
				undefined,
				learnTimeout
			)

			return msg.options
		} catch (e: any) {
			this.logger.warn('Error learning feedback options: ' + e?.message)
			this.#sendToModuleLog('error', 'Error learning feedback options: ' + e?.message)
		}
	}

	/**
	 * Inform the child instance class about an feedback that has been deleted
	 */
	async feedbackDelete(oldFeedback: FeedbackInstance): Promise<void> {
		if (oldFeedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a different instance`)

		await this.#ipcWrapper.sendWithCb('updateFeedbacks', {
			feedbacks: {
				// Mark as deleted
				[oldFeedback.id]: null,
			},
		})
	}

	/**
	 * Inform the child instance class about an updated action
	 */
	async actionUpdate(action: ActionInstance, controlId: string): Promise<void> {
		if (action.instance !== this.connectionId) throw new Error(`Action is for a different instance`)
		if (action.disabled) return

		await this.#ipcWrapper.sendWithCb('updateActions', {
			actions: {
				[action.id]: {
					id: action.id,
					controlId: controlId,
					actionId: action.action,
					options: action.options,

					upgradeIndex: action.upgradeIndex ?? null,
					disabled: !!action.disabled,
				},
			},
		})
	}
	/**
	 * Inform the child instance class about an action that has been deleted
	 */
	async actionDelete(oldAction: ActionInstance): Promise<void> {
		if (oldAction.instance !== this.connectionId) throw new Error(`Action is for a different instance`)

		await this.#ipcWrapper.sendWithCb('updateActions', {
			actions: {
				// Mark as deleted
				[oldAction.id]: null,
			},
		})
	}

	/**
	 *
	 */
	async actionLearnValues(
		action: ActionInstance,
		controlId: string
	): Promise<CompanionOptionValues | undefined | void> {
		if (action.instance !== this.connectionId) throw new Error(`Action is for a different instance`)

		const actionSpec = this.#registry.instance.definitions.getActionDefinition(this.connectionId, action.action)
		const learnTimeout = actionSpec?.learnTimeout

		try {
			const msg = await this.#ipcWrapper.sendWithCb(
				'learnAction',
				{
					action: {
						id: action.id,
						controlId: controlId,
						actionId: action.action,
						options: action.options,

						upgradeIndex: null,
						disabled: !!action.disabled,
					},
				},
				undefined,
				learnTimeout
			)

			return msg.options
		} catch (e: any) {
			this.logger.warn('Error learning action options: ' + e?.message)
			this.#sendToModuleLog('error', 'Error learning action options: ' + e?.message)
		}
	}

	/**
	 * Tell the child instance class to execute an action
	 */
	async actionRun(action: ActionInstance, extras: RunActionExtras): Promise<void> {
		if (action.instance !== this.connectionId) throw new Error(`Action is for a different instance`)

		try {
			await this.#ipcWrapper.sendWithCb('executeAction', {
				action: {
					id: action.id,
					controlId: extras?.controlId,
					actionId: action.action,
					options: action.options,

					upgradeIndex: null,
					disabled: !!action.disabled,
				},

				surfaceId: extras?.surfaceId,
			})
		} catch (e: any) {
			this.logger.warn(`Error executing action: ${e.message ?? e}`)
			this.#sendToModuleLog('error', 'Error executing action: ' + e?.message)

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
		} catch (e: any) {
			console.warn(`Destroy for "${this.connectionId}" errored: ${e}`)
		}

		// Stop socket.io commands being received
		this.#unsubListeners()

		// Cleanup any db collections
		// Future: for use in refactoring
		this.cleanup()
	}

	/**
	 * Perform any cleanup
	 */
	cleanup(): void {
		this.#registry.services.sharedUdpManager.leaveAllFromOwner(this.connectionId)
	}

	/**
	 *
	 */
	executeHttpRequest(req: express.Request, res: express.Response): void {
		if (this.#hasHttpHandler) {
			const requestData: CompanionHTTPRequest = {
				baseUrl: req.baseUrl,
				body: req.body,
				// @ts-ignore TODO
				headers: req.headers,
				hostname: req.hostname,
				// @ts-ignore TODO
				ip: req.ip,
				method: req.method,
				originalUrl: req.originalUrl,
				path: req.path,
				// @ts-ignore TODO
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
					const data = {
						status: 200,
						headers: {},
						body: '',
						...msg.response,
					}

					res.status(data.status)
					res.set(data.headers)
					res.send(data.body)
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
			this.logger.log(msg.level, msg.message)
		}

		// Send everything to the 'debug' page
		this.#sendToModuleLog(msg.level, msg.message.toString())
	}

	/**
	 * Send a message to the module 'debug' log page
	 */
	#sendToModuleLog(level: LogLevel, message: string): void {
		const debugLogRoom = ConnectionDebugLogRoom(this.connectionId)
		if (this.#registry.io.countRoomMembers(debugLogRoom) > 0) {
			this.#registry.io.emitToRoom(debugLogRoom, debugLogRoom, level, message)
		}
	}

	/**
	 * Handle updating instance status from the child process
	 */
	async #handleSetStatus(msg: SetStatusMessage): Promise<void> {
		// this.logger.silly(`Updating status`)

		this.#instanceStatus.updateInstanceStatus(this.connectionId, msg.status, msg.message)
	}

	/**
	 * Handle settings action definitions from the child process
	 */
	async #handleSetActionDefinitions(msg: SetActionDefinitionsMessage): Promise<void> {
		const actions: Record<string, ActionDefinition> = {}

		for (const rawAction of msg.actions || []) {
			actions[rawAction.id] = {
				label: rawAction.name,
				description: rawAction.description,
				// @ts-expect-error @companion-module-base exposes these through a mapping that loses the differentiation between types
				options: rawAction.options || [],
				hasLearn: !!rawAction.hasLearn,
				learnTimeout: rawAction.learnTimeout,
			}
		}

		this.#registry.instance.definitions.setActionDefinitions(this.connectionId, actions)
	}

	/**
	 * Handle settings feedback definitions from the child process
	 */
	async #handleSetFeedbackDefinitions(msg: SetFeedbackDefinitionsMessage): Promise<void> {
		const feedbacks: Record<string, FeedbackDefinition> = {}

		for (const rawFeedback of msg.feedbacks || []) {
			feedbacks[rawFeedback.id] = {
				label: rawFeedback.name,
				description: rawFeedback.description,
				// @ts-expect-error @companion-module-base exposes these through a mapping that loses the differentiation between types
				options: rawFeedback.options || [],
				type: rawFeedback.type,
				style: rawFeedback.defaultStyle,
				hasLearn: !!rawFeedback.hasLearn,
				learnTimeout: rawFeedback.learnTimeout,
				showInvert: rawFeedback.showInvert ?? shouldShowInvertForFeedback(rawFeedback.options || []),
			}
		}

		this.#registry.instance.definitions.setFeedbackDefinitions(this.connectionId, feedbacks)
	}

	/**
	 * Handle updating feedback values from the child process
	 */
	async #handleUpdateFeedbackValues(msg: UpdateFeedbackValuesMessage): Promise<void> {
		this.#registry.controls.updateFeedbackValues(this.connectionId, msg.values)
	}

	/**
	 * Handle updating variable values from the child process
	 */
	async #handleSetVariableValues(msg: SetVariableValuesMessage): Promise<void> {
		if (!this.#label) throw new Error(`Got call to handleSetVariableValues before init was called`)

		const variables: Record<string, CompanionVariableValue | undefined> = {}
		for (const variable of msg.newValues) {
			variables[variable.id] = variable.value
		}

		this.#registry.variables.values.setVariableValues(this.#label, variables)
	}

	/**
	 * Handle setting variable definitions from the child process
	 */
	async #handleSetVariableDefinitions(msg: SetVariableDefinitionsMessage): Promise<void> {
		if (!this.#label) throw new Error(`Got call to handleSetVariableDefinitions before init was called`)

		const idCheckRegex = /^([a-zA-Z0-9-_\.]+)$/
		const invalidIds = []

		const newVariables: VariableDefinitionTmp[] = []
		for (const variable of msg.variables) {
			// Enure it is correctly formed
			if (variable && typeof variable.name === 'string' && typeof variable.id === 'string') {
				// Ensure the ids are valid
				if (variable.id.match(idCheckRegex)) {
					newVariables.push({
						label: variable.name,
						name: variable.id,
					})
				} else {
					invalidIds.push(variable.id)
				}
			}
		}

		this.#registry.variables.definitions.setVariableDefinitions(this.#label, newVariables)

		if (msg.newValues) {
			const variables: Record<string, CompanionVariableValue | undefined> = {}
			for (const variable of msg.newValues) {
				variables[variable.id] = variable.value
			}

			this.#registry.variables.values.setVariableValues(this.#label, variables)
		}

		if (invalidIds.length > 0) {
			this.logger.warn(`Got variable definitions with invalid ids: ${JSON.stringify(invalidIds)}`)
			this.#sendToModuleLog('warn', `Got variable definitions with invalid ids: ${JSON.stringify(invalidIds)}`)
		}
	}

	/**
	 * Handle setting preset definitions from the child process
	 */
	async #handleSetPresetDefinitions(msg: SetPresetDefinitionsMessage): Promise<void> {
		try {
			if (!this.#label) throw new Error(`Got call to handleSetPresetDefinitions before init was called`)

			// Convert back to an object
			const presets: Record<string, PresetDefinitionTmp> = {}
			for (const preset of msg.presets) {
				presets[preset.id] = preset
			}

			this.#registry.instance.definitions.setPresetDefinitions(this.connectionId, this.#label, presets)
		} catch (e: any) {
			this.logger.error(`setPresetDefinitions: ${e}`)

			throw new Error(`Failed to set Preset Definitions: ${e}`)
		}
	}

	/**
	 * Handle saving an updated config object from the child process
	 */
	async #handleSaveConfig(msg: SaveConfigMessage): Promise<void> {
		// Save config, but do not automatically call this module's updateConfig again
		this.#registry.instance.setInstanceLabelAndConfig(this.connectionId, null, msg.config, true)
	}

	/**
	 * Handle sending an osc message from the child process
	 */
	async #handleSendOsc(msg: SendOscMessage): Promise<void> {
		this.#registry.services.oscSender.send(msg.host, msg.port, msg.path, msg.args)
	}

	/**
	 * Handle request to parse variables in a string
	 */
	async #handleParseVariablesInString(
		msg: ParseVariablesInStringMessage
	): Promise<ParseVariablesInStringResponseMessage> {
		try {
			const location = msg.controlId ? this.#registry.page.getLocationOfControlId(msg.controlId) : null
			const result = this.#registry.variables.values.parseVariables(msg.text, location)

			return {
				text: result.text,
				variableIds: result.variableIds,
			}
		} catch (e: any) {
			this.logger.error(`Parse variables failed: ${e}`)

			throw new Error(`Failed to parse variables in string`)
		}
	}

	/**
	 * Handle action recorded by the instance
	 */
	async #handleRecordAction(msg: RecordActionMessage): Promise<void> {
		let delay = msg.delay || 0
		if (isNaN(delay) || delay < 0) delay = 0

		try {
			this.#registry.controls.actionRecorder.receiveAction(
				this.connectionId,
				msg.actionId,
				msg.options,
				delay,
				msg.uniquenessId ?? undefined
			)
		} catch (e: any) {
			this.logger.error(`Record action failed: ${e}`)
		}
	}

	/**
	 * Handle the module setting a custom variable
	 */
	async #handleSetCustomVariable(msg: SetCustomVariableMessage): Promise<void> {
		try {
			this.#registry.variables.custom.setValue(msg.customVariableId, msg.value)
		} catch (e: any) {
			this.logger.error(`Set custom variable failed: ${e}`)
		}
	}

	/**
	 * Handle the module informing us of some actions/feedbacks which have been run through upgrade scripts
	 */
	async #handleUpgradedItems(msg: UpgradedDataResponseMessage): Promise<void> {
		try {
			// TODO - we should batch these changes when there are multiple on one control (to void excessive redrawing)

			for (const feedback of Object.values(msg.updatedFeedbacks)) {
				if (feedback) {
					const control = this.#registry.controls.getControl(feedback.controlId)
					const found =
						control?.supportsFeedbacks &&
						control.feedbacks.feedbackReplace(
							{
								id: feedback.id,
								type: feedback.feedbackId,
								options: feedback.options,
								style: feedback.style,
								isInverted: feedback.isInverted,
							},
							true
						)
					if (!found) {
						this.logger.silly(`Failed to replace upgraded feedback: ${feedback.id} ${feedback.controlId}`)
					}
				}
			}

			for (const action of Object.values(msg.updatedActions)) {
				if (action) {
					const control = this.#registry.controls.getControl(action.controlId)
					const found =
						control?.supportsActions &&
						control.actionReplace(
							{
								id: action.id,
								action: action.actionId,
								options: action.options,
							},
							true
						)
					if (!found) {
						this.logger.silly(`Failed to replace upgraded action: ${action.id} ${action.controlId}`)
					}
				}
			}
		} catch (e: any) {
			this.logger.error(`Upgrades failed to save: ${e}`)
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
		const handleId = await this.#registry.services.sharedUdpManager.joinPort(
			msg.family,
			msg.portNumber,
			this.connectionId,
			(message, rInfo) => {
				this.#ipcWrapper.sendWithNoCb('sharedUdpSocketMessage', {
					handleId,
					portNumber: msg.portNumber,
					message: message,
					source: rInfo,
				})
			},
			(error) => {
				this.#ipcWrapper.sendWithNoCb('sharedUdpSocketError', {
					handleId,
					portNumber: msg.portNumber,
					error: error,
				})
			}
		)
		return handleId
	}
	/**
	 *
	 */
	async #handleSharedUdpSocketLeave(msg: SharedUdpSocketMessageLeave): Promise<void> {
		this.#registry.services.sharedUdpManager.leavePort(this.connectionId, msg.handleId)
	}
	/**
	 *
	 */
	async #handleSharedUdpSocketSend(msg: SharedUdpSocketMessageSend): Promise<void> {
		this.#registry.services.sharedUdpManager.sendOnPort(
			this.connectionId,
			msg.handleId,
			msg.address,
			msg.port,
			msg.message
		)
	}
}

function shouldShowInvertForFeedback(options: CompanionInputFieldBase[]): boolean {
	for (const option of options) {
		if (option.type === 'checkbox' && (option.id === 'invert' || option.id === 'inverted')) {
			// It looks like there is already a matching field
			return false
		}
	}

	// Nothing looked to be a user defined invert field
	return true
}

export interface RunActionExtras {
	controlId: string
	surfaceId: string | undefined
	location: ControlLocation | undefined
}

export interface VariableDefinitionTmp {
	label: string
	name: string
}
