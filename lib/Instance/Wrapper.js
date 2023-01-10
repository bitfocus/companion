import LogController from '../Log/Controller.js'
import { CreateBankControlId, ParseControlId } from '../Shared/ControlId.js'
import { IpcWrapper } from '@companion-module/base/dist/host-api/ipc-wrapper.js'
import e from 'express'
import { ConnectionDebugLogRoom } from './Host.js'

class SocketEventsHandler {
	constructor(registry, instanceStatus, monitor, connectionId) {
		this.logger = LogController.createLogger(`Instance/Wrapper/${connectionId}`)

		this.registry = registry
		this.instanceStatus = instanceStatus

		this.connectionId = connectionId
		this.hasHttpHandler = false
		this.hasRecordActionsHandler = false

		this.ipcWrapper = new IpcWrapper(
			{
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
			},
			(msg) => {
				if (monitor.child) {
					monitor.child.send(msg)
				} else {
					this.logger.debug(`Child is not running, unable to send message: ${JSON.stringify(msg)}`)
				}
			},
			5000
		)

		const messageHandler = (msg) => {
			this.ipcWrapper.receivedMessage(msg)
		}
		monitor.child.on('message', messageHandler)

		this.unsubListeners = () => {
			monitor.child.off('message', messageHandler)
		}
	}

	/**
	 * Initialise the instance class running in the child process
	 * @param {object} config
	 */
	async init(config) {
		this.logger = LogController.createLogger(`Instance/Wrapper/${config.label}`)
		this.label = config.label

		const allFeedbacks = this.#getAllFeedbackInstances()
		const allActions = this.#getAllActionInstances()

		const msg = await this.ipcWrapper.sendWithCb('init', {
			label: config.label,
			isFirstInit: config.isFirstInit,
			config: config.config,

			lastUpgradeIndex: config.lastUpgradeIndex,

			// Pass all actions and feedbacks for upgrading and initial subscribe calls
			actions: allActions,
			feedbacks: allFeedbacks,
		})

		// Save the resulting values
		this.hasHttpHandler = !!msg.hasHttpHandler
		this.hasRecordActionsHandler = !!msg.hasRecordActionsHandler
		config.lastUpgradeIndex = msg.newUpgradeIndex
		this.registry.instance.setInstanceLabelAndConfig(this.connectionId, null, msg.updatedConfig, true)
	}

	/**
	 * Forward an updated config object to the instance class
	 * @param {object} config
	 */
	async updateConfig(config) {
		await this.ipcWrapper.sendWithCb('updateConfig', config)
	}

	/**
	 * Handle an updated label
	 * @param {object} config
	 */
	async updateLabel(label) {
		this.logger = LogController.createLogger(`Instance/Wrapper/${label}`)
		this.label = label
	}

	/**
	 * Fetch the config fields from the instance to show in the ui
	 * @returns config fields
	 */
	async requestConfigFields() {
		try {
			const res = await this.ipcWrapper.sendWithCb('getConfigFields', {})
			return res.fields
		} catch (e) {
			this.logger.warn('Error getting config fields: ' + e?.message)
			throw e
		}
	}

	/**
	 * Get all the feedback instances for this instance
	 * @access private
	 * @returns
	 */
	#getAllFeedbackInstances() {
		const allFeedbacks = {}

		// Find all the feedbacks on banks
		const allControls = this.registry.controls.getAllControls()
		for (const [controlId, control] of Object.entries(allControls)) {
			if (control.feedbacks && control.feedbacks.feedbacks && control.feedbacks.feedbacks.length > 0) {
				const imageSize = control.getBitmapSize()
				for (const feedback of control.feedbacks.feedbacks) {
					const parsed = ParseControlId(controlId)
					if (feedback.instance_id === this.connectionId && parsed?.type === 'bank') {
						allFeedbacks[feedback.id] = {
							id: feedback.id,
							controlId: controlId,
							feedbackId: feedback.type,
							options: feedback.options,

							upgradeIndex: feedback.upgradeIndex,
							disabled: feedback.disabled,

							image: imageSize,
							page: parsed.page,
							bank: parsed.bank,

							// Pass the current default style for compatability reasons
							rawBank: control.config,
						}
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
	async sendAllFeedbackInstances() {
		const msg = {
			feedbacks: this.#getAllFeedbackInstances(),
		}

		await this.ipcWrapper.sendWithCb('updateFeedbacks', msg)
	}

	/**
	 * Send the list of changed variables to the child process
	 * @access public - called whenever variables change
	 */
	async sendVariablesChanged(changedVariableIds) {
		// Future: only inform module of variables it parsed and should react to.
		// This will help avoid excess work when variables are not interesting to a module.

		this.ipcWrapper.sendWithNoCb('variablesChanged', {
			variablesIds: changedVariableIds,
		})
	}

	/**
	 * Get all the action instances for this instance
	 * @access private
	 * @returns
	 */
	#getAllActionInstances() {
		const allActions = {}

		const allControls = this.registry.controls.getAllControls()
		for (const [controlId, control] of Object.entries(allControls)) {
			if (typeof control.getAllActions === 'function') {
				const actions = control.getAllActions()

				for (const action of actions) {
					const parsed = ParseControlId(controlId)
					if (action.instance == this.connectionId) {
						allActions[action.id] = {
							id: action.id,
							controlId: controlId,
							actionId: action.action,
							options: action.options,

							upgradeIndex: action.upgradeIndex,
							disabled: action.disabled,

							page: parsed?.page,
							bank: parsed?.bank,
						}
					}
				}
			}
		}

		return allActions
	}

	/**
	 * Send all action instances to the child process
	 * @access private
	 */
	async #sendAllActionInstances() {
		const msg = {
			actions: this.#getAllActionInstances(),
		}

		await this.ipcWrapper.sendWithCb('updateActions', msg)
	}

	/**
	 * Inform the child instance class about an updated feedback
	 * @param {object} feedback
	 * @param {string} controlId
	 */
	async feedbackUpdate(feedback, controlId) {
		if (feedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a diferent instance`)
		if (feedback.disabled) return

		const parsedId = ParseControlId(controlId)

		const control = this.registry.controls.getControl(controlId)

		await this.ipcWrapper.sendWithCb('updateFeedbacks', {
			feedbacks: {
				[feedback.id]: {
					id: feedback.id,
					controlId: controlId,
					feedbackId: feedback.type,
					options: feedback.options,

					image: control?.getBitmapSize(),
					page: parsedId?.page,
					bank: parsedId?.bank,

					// Pass the current default style for compatability reasons
					rawBank: control?.config,
				},
			},
		})
	}

	async feedbackLearnValues(feedback) {
		try {
			const msg = await this.ipcWrapper.sendWithCb('learnFeedback', {
				feedback,
			})

			return msg.options
		} catch (e) {
			this.logger.warn('Error learning feedback options: ' + e?.message)
		}
	}

	/**
	 * Inform the child instance class about an feedback that has been deleted
	 * @param {object} oldFeedback
	 */
	async feedbackDelete(oldFeedback) {
		if (oldFeedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a diferent instance`)

		await this.ipcWrapper.sendWithCb('updateFeedbacks', {
			feedbacks: {
				// Mark as deleted
				[oldFeedback.id]: null,
			},
		})
	}

	/**
	 * Inform the child instance class about an updated action
	 * @param {object} action
	 * @param {string} controlId
	 */
	async actionUpdate(action, controlId) {
		if (action.instance !== this.connectionId) throw new Error(`Action is for a diferent instance`)
		if (action.disabled) return

		const parsedId = ParseControlId(controlId)

		await this.ipcWrapper.sendWithCb('updateActions', {
			actions: {
				[action.id]: {
					id: action.id,
					controlId: controlId,
					actionId: action.action,
					options: action.options,

					page: parsedId?.page,
					bank: parsedId?.bank,
				},
			},
		})
	}
	/**
	 * Inform the child instance class about an action that has been deleted
	 * @param {object} oldAction
	 */
	async actionDelete(oldAction) {
		if (oldAction.instance !== this.connectionId) throw new Error(`Action is for a diferent instance`)

		await this.ipcWrapper.sendWithCb('updateActions', {
			actions: {
				// Mark as deleted
				[oldAction.id]: null,
			},
		})
	}

	async actionLearnValues(action) {
		try {
			const msg = await this.ipcWrapper.sendWithCb('learnAction', {
				action,
			})

			return msg.options
		} catch (e) {
			this.logger.warn('Error learning action options: ' + e?.message)
		}
	}

	/**
	 * Tell the child instance class to execute an action
	 * @param {object} action
	 * @param {object} extras
	 */
	async actionRun(action, extras) {
		if (action.instance !== this.connectionId) throw new Error(`Action is for a diferent instance`)

		try {
			await this.ipcWrapper.sendWithCb('executeAction', {
				action: {
					id: action.id,
					controlId: CreateBankControlId(extras?.page, extras?.bank), // A temporary identifier
					actionId: action.action,
					options: action.options,

					page: extras?.page,
					bank: extras?.bank,
				},

				deviceId: extras?.deviceid,
			})
		} catch (e) {
			this.logger.warn(`Error executing action: ${e.message ?? e}`)

			throw e
		}
	}

	/**
	 * Tell the child instance class to 'destroy' itself
	 */
	async destroy() {
		// Cleanup the system once the module is destroyed

		try {
			await this.ipcWrapper.sendWithCb('destroy', {})
		} catch (e) {
			console.warn(`Destroy for "${this.connectionId}" errored: ${e}`)
		}

		// Stop socket.io commands being received
		this.unsubListeners()

		// Cleanup any db collections
		// Future: for use in refactoring
	}

	executeHttpRequest(req, res) {
		if (this.hasHttpHandler) {
			const requestData = {
				baseUrl: req.baseUrl,
				body: req.body,
				headers: req.headers,
				hostname: req.hostname,
				ip: req.ip,
				method: req.method,
				originalUrl: req.originalUrl,
				path: req.path,
				query: req.query,
			}

			const defaultResponse = () => ({
				status: 504,
				body: JSON.stringify({ status: 504, message: 'Gateway Timeout' }),
			})

			this.ipcWrapper
				.sendWithCb(
					'handleHttpRequest',
					{
						request: requestData,
					},
					defaultResponse
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
					res.status(500).send(JSON.stringify({ status: 500, message: 'Internal Server Error' }))
				})
		} else {
			res.status(404).send(JSON.stringify({ status: 404, message: 'Not Found' }))
		}
	}

	/**
	 * Handle a log message from the child process
	 */
	async #handleLogMessage(msg) {
		if (msg.level === 'error' || msg.level === 'warning' || msg.level === 'info') {
			// Ignore debug from modules in main log
			this.logger.log(msg.level, msg.message)
		}

		// Send everything to the 'debug' page
		const debugLogRoom = ConnectionDebugLogRoom(this.connectionId)
		this.registry.io.emitToRoom(debugLogRoom, debugLogRoom, msg.level, msg.message.toString())
	}
	/**
	 * Handle updating instance status from the child process
	 */
	async #handleSetStatus(msg) {
		// this.logger.silly(`Updating status`)

		this.instanceStatus.updateInstanceStatus(this.connectionId, msg.status, msg.message)
	}

	/**
	 * Handle settings action definitions from the child process
	 */
	async #handleSetActionDefinitions(msg) {
		const actions = {}

		for (const rawAction of msg.actions || []) {
			actions[rawAction.id] = {
				label: rawAction.name,
				description: rawAction.description,
				options: rawAction.options || [],
			}
		}

		this.registry.instance.definitions.setActionDefinitions(this.connectionId, actions)
	}

	/**
	 * Handle settings feedback definitions from the child process
	 */
	async #handleSetFeedbackDefinitions(msg) {
		const feedbacks = {}

		for (const rawFeedback of msg.feedbacks || []) {
			feedbacks[rawFeedback.id] = {
				label: rawFeedback.name,
				description: rawFeedback.description,
				options: rawFeedback.options || [],
				type: rawFeedback.type,
				style: rawFeedback.defaultStyle,
			}
		}

		this.registry.instance.definitions.setFeedbackDefinitions(this.connectionId, feedbacks)
	}

	/**
	 * Handle updating feedback values from the child process
	 */
	async #handleUpdateFeedbackValues(msg) {
		this.registry.controls.updateFeedbackValues(this.connectionId, msg.values)
	}

	/**
	 * Handle updating variable values from the child process
	 */
	async #handleSetVariableValues(msg) {
		const variables = {}
		for (const variable of msg.newValues) {
			variables[variable.id] = variable.value
		}

		this.registry.instance.variable.setVariableValues(this.label, variables)
	}

	/**
	 * Handle setting variable definitions from the child process
	 */
	async #handleSetVariableDefinitions(msg) {
		const idCheckRegex = /^([a-zA-Z0-9-_\.]+)$/
		const invalidIds = []

		const newVariables = []
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

		this.registry.instance.variable.setVariableDefinitions(this.label, newVariables)

		if (invalidIds.length > 0) {
			this.logger.warn(`Got variable definitions with invalid ids: ${JSON.stringify(invalidIds)}`)
		}
	}

	/**
	 * Handle setting preset definitions from the child process
	 */
	async #handleSetPresetDefinitions(msg) {
		try {
			// Convert back to an object
			const presets = {}
			for (const preset of msg.presets) {
				presets[preset.id] = preset
			}

			this.registry.instance.definitions.setPresetDefinitions(this.connectionId, this.label, presets)
		} catch (e) {
			this.logger.error(`setPresetDefinitions: ${e}`)

			throw new Error(`Failed to set Preset Definitions: ${e}`)
		}
	}

	/**
	 * Handle saving an updated config object from the child process
	 */
	async #handleSaveConfig(msg) {
		// Save config, but do not automatically call this module's updateConfig again
		this.registry.instance.setInstanceLabelAndConfig(this.connectionId, null, msg.config, true)
	}

	/**
	 * Handle sending an osc message from the child process
	 */
	async #handleSendOsc(msg) {
		this.registry.services.oscSender.send(msg.host, msg.port, msg.path, msg.args)
	}

	/**
	 * Handle request to parse variables in a string
	 */
	async #handleParseVariablesInString(msg) {
		try {
			const result = this.registry.instance.variable.parseVariables(msg.text)

			return { text: result.text, variableIds: result.variableIds }
		} catch (e) {
			this.logger.error(`Parse variables failed: ${e}`)

			throw new Error(`Failed to parse variables in string`)
		}
	}

	/**
	 * Handle action recorded by the instance
	 */
	async #handleRecordAction(msg) {
		try {
			this.registry.controls.actionRecorder.receiveAction(
				this.connectionId,
				msg.actionId,
				msg.options,
				msg.uniquenessId
			)
		} catch (e) {
			this.logger.error(`Record action failed: ${e}`)
		}
	}

	/**
	 * Handle the module setting a custom variable
	 */
	async #handleSetCustomVariable(msg) {
		try {
			this.registry.instance.variable.custom.setValue(msg.customVariableId, msg.value)
		} catch (e) {
			this.logger.error(`Set custom variable failed: ${e}`)
		}
	}

	/**
	 * Handle the module informing us of some actions/feedbacks which have been run through upgrade scripts
	 */
	async #handleUpgradedItems(msg) {
		try {
			// TODO - we should batch these changes when there are multiple on one control (to void excessive redrawing)

			for (const feedback of Object.values(msg.updatedFeedbacks)) {
				if (feedback) {
					const control = this.registry.controls.getControl(feedback.controlId)
					const found = control?.feedbacks?.feedbackReplace?.(feedback) ?? false
					if (!found) {
						this.logger.silly(`Failed to replace upgraded feedback: ${feedback.id} ${feedback.controlId}`)
					}
				}
			}

			for (const action of Object.values(msg.updatedActions)) {
				if (action) {
					const control = this.registry.controls.getControl(action.controlId)
					const found = control?.actionReplace?.(action) ?? false
					if (!found) {
						this.logger.silly(`Failed to replace upgraded action: ${action.id} ${action.controlId}`)
					}
				}
			}
		} catch (e) {
			this.logger.error(`Upgrades failed to save: ${e}`)
		}
	}

	/**
	 * Inform the child instance class to start or stop recording actions
	 * @param {boolean} recording
	 */
	async startStopRecordingActions(recording) {
		await this.ipcWrapper.sendWithCb('startStopRecordActions', {
			recording: recording,
		})
	}
}

export default SocketEventsHandler
