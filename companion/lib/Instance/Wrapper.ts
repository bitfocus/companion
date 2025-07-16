import LogController, { Logger } from '../Log/Controller.js'
import { IpcEventHandlers, IpcWrapper } from '@companion-module/base/dist/host-api/ipc-wrapper.js'
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
	EncodeIsVisible,
} from '@companion-module/base/dist/host-api/api.js'
import type { InstanceStatus } from './Status.js'
import type { ConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import {
	assertNever,
	SomeCompanionActionInputField,
	type CompanionHTTPRequest,
	type CompanionInputFieldBase,
	type CompanionOptionValues,
	type LogLevel,
} from '@companion-module/base'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { InstanceDefinitions, PresetDefinitionTmp } from './Definitions.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { VariablesController } from '../Variables/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { ServiceOscSender } from '../Service/OscSender.js'
import type { InstanceSharedUdpManager } from './SharedUdpManager.js'
import {
	ActionEntityModel,
	EntityModelType,
	FeedbackEntityModel,
	isValidFeedbackEntitySubType,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ClientEntityDefinition } from '@companion-app/shared/Model/EntityDefinitionModel.js'
import type { Complete } from '@companion-module/base/dist/util.js'
import type { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import { doesModuleExpectLabelUpdates, doesModuleUseSeparateUpgradeMethod } from './ApiVersions.js'
import { InternalActionInputField, InternalFeedbackInputField } from '@companion-app/shared/Model/Options.js'
import { InstanceEntityManager } from './EntityManager.js'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'

export interface InstanceModuleWrapperDependencies {
	readonly controls: ControlsController
	readonly variables: VariablesController
	readonly pageStore: IPageStore
	readonly oscSender: ServiceOscSender

	readonly instanceDefinitions: InstanceDefinitions
	readonly instanceStatus: InstanceStatus
	readonly sharedUdpManager: InstanceSharedUdpManager

	readonly setConnectionConfig: (
		connectionId: string,
		config: unknown | null,
		secrets: unknown | null,
		newUpgradeIndex: number | null
	) => void
	readonly debugLogLine: (connectionId: string, level: string, message: string) => void
}

export class SocketEventsHandler {
	logger: Logger

	readonly #ipcWrapper: IpcWrapper<HostToModuleEventsV0, ModuleToHostEventsV0>

	readonly #deps: InstanceModuleWrapperDependencies

	readonly connectionId: string

	#hasHttpHandler = false

	hasRecordActionsHandler: boolean = false

	#expectsLabelUpdates: boolean = false

	readonly #entityManager: InstanceEntityManager | null

	#currentUpgradeIndex: number | null = null

	/**
	 * Current label of the connection
	 */
	#label: string

	/**
	 * Unsubscribe listeners, for use during cleanup
	 */
	#unsubListeners: () => void

	constructor(
		deps: InstanceModuleWrapperDependencies,
		monitor: RespawnMonitor,
		connectionId: string,
		apiVersion0: string
	) {
		this.logger = LogController.createLogger(`Instance/Wrapper/${connectionId}`)

		const apiVersion = semver.parse(apiVersion0)
		if (!apiVersion) throw new Error(`Failed to parse apiVersion "${apiVersion0}"`)

		this.#deps = deps

		this.connectionId = connectionId
		this.#label = connectionId // Give a default label until init is called
		this.#expectsLabelUpdates = doesModuleExpectLabelUpdates(apiVersion)

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

		this.#entityManager = doesModuleUseSeparateUpgradeMethod(apiVersion)
			? new InstanceEntityManager(this.#ipcWrapper, this.#deps.controls, this.#deps.pageStore, this.connectionId)
			: null

		const messageHandler = (msg: any) => {
			this.#ipcWrapper.receivedMessage(msg)
		}
		monitor.child?.on('message', messageHandler)

		this.#unsubListeners = () => {
			monitor.child?.off('message', messageHandler)
		}
	}

	/**
	 * Initialise the instance class running in the child process
	 */
	async init(config: ConnectionConfig): Promise<void> {
		this.logger = LogController.createLogger(`Instance/Wrapper/${config.label}`)
		this.#label = config.label

		const allFeedbacks = this.#entityManager ? {} : this.#getAllFeedbackInstances()
		const allActions = this.#entityManager ? {} : this.#getAllActionInstances()

		// Ensure each entity knows its upgradeIndex
		const allControls = this.#deps.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			if (!control.supportsEntities) continue

			for (const entity of control.entities.getAllEntities()) {
				if (entity.connectionId !== this.connectionId) continue

				if (entity.upgradeIndex === undefined) {
					entity.setMissingUpgradeIndex(config.lastUpgradeIndex)
				}

				this.#entityManager?.trackEntity(entity, controlId)
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
		this.#currentUpgradeIndex = config.lastUpgradeIndex = msg.newUpgradeIndex
		this.#deps.setConnectionConfig(this.connectionId, msg.updatedConfig, msg.updatedSecrets, msg.newUpgradeIndex)

		this.#entityManager?.start(config.lastUpgradeIndex)
	}

	/**
	 * Forward an updated config object to the instance class
	 */
	async updateConfigAndLabel(config: ConnectionConfig): Promise<void> {
		this.logger = LogController.createLogger(`Instance/Wrapper/${config.label}`)
		this.#label = config.label

		if (this.#expectsLabelUpdates) {
			await this.#ipcWrapper.sendWithCb('updateConfigAndLabel', {
				config: config.config,
				secrets: config.secrets,
				label: config.label,
			})
		} else {
			await this.#ipcWrapper.sendWithCb('updateConfig', config.config)
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
		const allControls = this.#deps.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			if (!control.supportsEntities) continue

			const controlEntities = control.entities.getAllEntities()
			if (!controlEntities || controlEntities.length === 0) continue

			const imageSize = control.getBitmapSize()
			for (const entity of controlEntities) {
				if (entity.connectionId !== this.connectionId) continue
				if (entity.type !== EntityModelType.Feedback) continue

				const entityModel = entity.asEntityModel(false) as FeedbackEntityModel
				allFeedbacks[entityModel.id] = {
					id: entityModel.id,
					controlId: controlId,
					feedbackId: entityModel.definitionId,
					options: entityModel.options,

					isInverted: !!entityModel.isInverted,

					upgradeIndex: entityModel.upgradeIndex ?? null,
					disabled: !!entityModel.disabled,

					image: imageSize ?? undefined,
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
		if (this.#entityManager) {
			this.#entityManager.resendFeedbacks()
			return
		}

		const msg = {
			feedbacks: this.#getAllFeedbackInstances(),
		}

		await this.#ipcWrapper.sendWithCb('updateFeedbacks', msg)
	}

	/**
	 * Send the list of changed variables to the child process
	 * @access public - called whenever variables change
	 */
	async sendVariablesChanged(changedVariableIdSet: Set<string>, changedVariableIds: string[]): Promise<void> {
		if (this.#entityManager) {
			this.#entityManager.onVariablesChanged(changedVariableIdSet)
			return
		}

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

		const allControls = this.#deps.controls.getAllControls()
		for (const [controlId, control] of allControls.entries()) {
			if (!control.supportsEntities) continue
			// const actions = .map(e => e.asEntityModel())

			for (const entity of control.entities.getAllEntities()) {
				if (entity.connectionId !== this.connectionId) continue
				if (entity.type !== EntityModelType.Action) continue

				const entityModel = entity.asEntityModel(false)

				allActions[entity.id] = {
					id: entityModel.id,
					controlId: controlId,
					actionId: entityModel.definitionId,
					options: entityModel.options,

					upgradeIndex: entityModel.upgradeIndex ?? null,
					disabled: !!entityModel.disabled,
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

	async entityUpdate(entity: ControlEntityInstance, controlId: string): Promise<void> {
		if (this.#entityManager) {
			if (entity.connectionId !== this.connectionId) throw new Error(`Feedback is for a different connection`)
			if (entity.disabled) return

			this.#entityManager.trackEntity(entity, controlId)
			return
		}

		const entityModel = entity.asEntityModel(false)
		switch (entityModel.type) {
			case EntityModelType.Action:
				return this.#actionUpdate(entityModel, controlId)
			case EntityModelType.Feedback:
				return this.#feedbackUpdate(entityModel, controlId)
		}
	}

	/**
	 * Inform the child instance class about an updated feedback
	 */
	async #feedbackUpdate(feedback: FeedbackEntityModel, controlId: string): Promise<void> {
		if (feedback.connectionId !== this.connectionId) throw new Error(`Feedback is for a different connection`)
		if (feedback.disabled) return

		const control = this.#deps.controls.getControl(controlId)

		await this.#ipcWrapper.sendWithCb('updateFeedbacks', {
			feedbacks: {
				[feedback.id]: {
					id: feedback.id,
					controlId: controlId,
					feedbackId: feedback.definitionId,
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
	async entityLearnValues(
		entity: SomeEntityModel,
		controlId: string
	): Promise<CompanionOptionValues | undefined | void> {
		if (entity.connectionId !== this.connectionId) throw new Error(`Entity is for a different connection`)

		const entityDefinition = this.#deps.instanceDefinitions.getEntityDefinition(
			entity.type,
			this.connectionId,
			entity.definitionId
		)
		const learnTimeout = entityDefinition?.learnTimeout

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
								options: entity.options,

								upgradeIndex: null,
								disabled: !!entity.disabled,
							},
						},
						undefined,
						learnTimeout
					)

					return msg.options
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
								options: entity.options,

								isInverted: !!entity.isInverted,

								image: control?.getBitmapSize() ?? undefined,

								upgradeIndex: null,
								disabled: !!entity.disabled,
							},
						},
						undefined,
						learnTimeout
					)

					return msg.options
				}
				default:
					assertNever(entity)
					break
			}
		} catch (e: any) {
			this.logger.warn('Error learning options: ' + e?.message)
			this.#sendToModuleLog('error', 'Error learning options: ' + e?.message)
		}
	}

	/**
	 * Inform the child instance class about an entity that has been deleted
	 */
	async entityDelete(oldEntity: SomeEntityModel): Promise<void> {
		if (oldEntity.connectionId !== this.connectionId) throw new Error(`Entity is for a different connection`)

		if (this.#entityManager) {
			this.#entityManager.forgetEntity(oldEntity.id)
			return
		}

		switch (oldEntity.type) {
			case EntityModelType.Action:
				await this.#ipcWrapper.sendWithCb('updateActions', {
					actions: {
						// Mark as deleted
						[oldEntity.id]: null,
					},
				})
				break
			case EntityModelType.Feedback:
				await this.#ipcWrapper.sendWithCb('updateFeedbacks', {
					feedbacks: {
						// Mark as deleted
						[oldEntity.id]: null,
					},
				})
				break
			default:
				assertNever(oldEntity)
				break
		}
	}

	/**
	 * Inform the child instance class about an updated action
	 */
	async #actionUpdate(action: ActionEntityModel, controlId: string): Promise<void> {
		if (action.connectionId !== this.connectionId) throw new Error(`Action is for a different connection`)
		if (action.disabled) return

		await this.#ipcWrapper.sendWithCb('updateActions', {
			actions: {
				[action.id]: {
					id: action.id,
					controlId: controlId,
					actionId: action.definitionId,
					options: action.options,

					upgradeIndex: action.upgradeIndex ?? null,
					disabled: !!action.disabled,
				},
			},
		})
	}

	/**
	 * Tell the child instance class to execute an action
	 */
	async actionRun(action: ActionEntityModel, extras: RunActionExtras): Promise<void> {
		if (action.connectionId !== this.connectionId) throw new Error(`Action is for a different connection`)

		try {
			let actionOptions = action.options
			if (this.#entityManager) {
				// This means the new flow is being done, and the options must be parsed at this stage
				const actionDefinition = this.#deps.instanceDefinitions.getEntityDefinition(
					EntityModelType.Action,
					this.connectionId,
					action.definitionId
				)
				if (!actionDefinition) throw new Error(`Failed to find action definition for ${action.definitionId}`)

				// Note: for actions, this case doesn't need to be reactive
				actionOptions = this.#entityManager.parseOptionsObject(actionDefinition, actionOptions, extras.location)
			}

			await this.#ipcWrapper.sendWithCb('executeAction', {
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
		this.#deps.sharedUdpManager.leaveAllFromOwner(this.connectionId)

		this.#entityManager?.destroy()
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
	#sendToModuleLog(level: LogLevel | 'system', message: string): void {
		this.#deps.debugLogLine(this.connectionId, level, message)
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
		const actions: Record<string, ClientEntityDefinition> = {}

		this.#sendToModuleLog('debug', `Updating action definitions (${(msg.actions || []).length} actions)`)

		for (const rawAction of msg.actions || []) {
			actions[rawAction.id] = {
				entityType: EntityModelType.Action,
				label: rawAction.name,
				description: rawAction.description,
				options: translateOptionsIsVisible(rawAction.options || []),
				hasLearn: !!rawAction.hasLearn,
				learnTimeout: rawAction.learnTimeout,

				showInvert: false,
				showButtonPreview: false,
				supportsChildGroups: [],

				feedbackType: null,
				feedbackStyle: undefined,
			} satisfies Complete<ClientEntityDefinition>
		}

		this.#deps.instanceDefinitions.setActionDefinitions(this.connectionId, actions)
	}

	/**
	 * Handle settings feedback definitions from the child process
	 */
	async #handleSetFeedbackDefinitions(msg: SetFeedbackDefinitionsMessage): Promise<void> {
		const feedbacks: Record<string, ClientEntityDefinition> = {}

		this.#sendToModuleLog('debug', `Updating feedback definitions (${(msg.feedbacks || []).length} feedbacks)`)

		for (const rawFeedback of msg.feedbacks || []) {
			if (!isValidFeedbackEntitySubType(rawFeedback.type)) continue

			feedbacks[rawFeedback.id] = {
				entityType: EntityModelType.Feedback,
				label: rawFeedback.name,
				description: rawFeedback.description,
				options: translateOptionsIsVisible(rawFeedback.options || []),
				feedbackType: rawFeedback.type,
				feedbackStyle: rawFeedback.defaultStyle,
				hasLearn: !!rawFeedback.hasLearn,
				learnTimeout: rawFeedback.learnTimeout,
				showInvert: rawFeedback.showInvert ?? shouldShowInvertForFeedback(rawFeedback.options || []),

				showButtonPreview: false,
				supportsChildGroups: [],
			} satisfies Complete<ClientEntityDefinition>
		}

		this.#deps.instanceDefinitions.setFeedbackDefinitions(this.connectionId, feedbacks)
	}

	/**
	 * Handle updating feedback values from the child process
	 */
	async #handleUpdateFeedbackValues(msg: UpdateFeedbackValuesMessage): Promise<void> {
		this.#deps.controls.updateFeedbackValues(this.connectionId, msg.values)
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

		const idCheckRegex = /^([a-zA-Z0-9-_.]+)$/
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

		this.#sendToModuleLog('debug', `Updating variable definitions (${newVariables.length} variables)`)

		this.#deps.variables.definitions.setVariableDefinitions(this.#label, newVariables)

		if (msg.newValues) {
			this.#deps.variables.values.setVariableValues(this.#label, msg.newValues)
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

			this.#deps.instanceDefinitions.setPresetDefinitions(this.connectionId, this.#label, presets)
		} catch (e: any) {
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
		this.#deps.oscSender.send(msg.host, msg.port, msg.path, msg.args)
	}

	/**
	 * Handle request to parse variables in a string
	 */
	async #handleParseVariablesInString(
		msg: ParseVariablesInStringMessage
	): Promise<ParseVariablesInStringResponseMessage> {
		try {
			const location = msg.controlId ? this.#deps.pageStore.getLocationOfControlId(msg.controlId) : null

			const parser = this.#deps.controls.createVariablesAndExpressionParser(location, null)
			const result = parser.parseVariables(msg.text)

			return {
				text: result.text,
				variableIds: Array.from(result.variableIds),
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
			this.#deps.controls.actionRecorder.receiveAction(
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
			this.#deps.variables.custom.setValue(msg.customVariableId, msg.value)
		} catch (e: any) {
			this.logger.error(`Set custom variable failed: ${e}`)
		}
	}

	/**
	 * Handle the module informing us of some actions/feedbacks which have been run through upgrade scripts
	 */
	async #handleUpgradedItems(msg: UpgradedDataResponseMessage): Promise<void> {
		if (this.#entityManager) {
			this.logger.error(`Module should not be using 'upgradedItems' as it uses the new upgrade flow`)
			throw new Error(`Module should not be using 'upgradedItems' as it uses the new upgrade flow`)
		}

		try {
			// TODO - we should batch these changes when there are multiple on one control (to void excessive redrawing)

			for (const feedback of Object.values(msg.updatedFeedbacks)) {
				if (feedback) {
					const control = this.#deps.controls.getControl(feedback.controlId)
					const found =
						control?.supportsEntities &&
						control.entities.entityReplace(
							{
								type: EntityModelType.Feedback,
								id: feedback.id,
								definitionId: feedback.feedbackId,
								options: feedback.options,
								style: feedback.style,
								isInverted: feedback.isInverted,
								upgradeIndex: feedback.upgradeIndex ?? this.#currentUpgradeIndex ?? undefined,
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
					const control = this.#deps.controls.getControl(action.controlId)
					const found =
						control?.supportsEntities &&
						control.entities.entityReplace(
							{
								type: EntityModelType.Action,
								id: action.id,
								definitionId: action.actionId,
								options: action.options,
								upgradeIndex: action.upgradeIndex ?? this.#currentUpgradeIndex ?? undefined,
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
		const handleId = await this.#deps.sharedUdpManager.joinPort(
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
		this.#deps.sharedUdpManager.leavePort(this.connectionId, msg.handleId)
	}
	/**
	 *
	 */
	async #handleSharedUdpSocketSend(msg: SharedUdpSocketMessageSend): Promise<void> {
		this.#deps.sharedUdpManager.sendOnPort(this.connectionId, msg.handleId, msg.address, msg.port, msg.message)
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

export function translateOptionsIsVisible(
	options?: EncodeIsVisible<SomeCompanionActionInputField>[]
): (InternalActionInputField | InternalFeedbackInputField)[] {
	// @companion-module-base exposes these through a mapping that loses the differentiation between types
	return (options || []).map((o) => {
		let isVisibleUi: InternalFeedbackInputField['isVisibleUi'] | undefined = undefined
		if (o.isVisibleFn && o.isVisibleFnType === 'expression') {
			isVisibleUi = {
				type: 'expression',
				fn: o.isVisibleFn,
				data: undefined,
			}
		} else if (o.isVisibleFn) {
			// Either type: 'function' or undefined (backwards compat)
			isVisibleUi = {
				type: 'function',
				fn: o.isVisibleFn,
				data: o.isVisibleData,
			}
		}

		return {
			...(o as any),
			isVisibleFn: undefined,
			isVisibleData: undefined,
			isVisibleUi,
		}
	})
}

export interface RunActionExtras {
	controlId: string
	surfaceId: string | undefined
	location: ControlLocation | undefined
	abortDelayed: AbortSignal
	executionMode: 'sequential' | 'concurrent'
}

export interface VariableDefinitionTmp {
	label: string
	name: string
}
