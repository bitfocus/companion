import LogController from '../Log/Controller.js'
import PTimeout from 'p-timeout'
import { CreateBankControlId, CreateTriggerControlId, ParseControlId } from '../Resources/Util.js'

async function socketEmit(socket, name, msg, defaultVal, timeout = 5000) {
	const p = new Promise((resolve, reject) => {
		const innerCb = (err, res) => {
			if (err) reject(err)
			else resolve(res)
		}
		socket.emit(name, msg, innerCb)
	})

	return PTimeout(p, {
		milliseconds: timeout,
		message: defaultVal ?? `Message to module "${name}" timed out`,
	})
}

class SocketEventsHandler {
	constructor(registry, instanceStatus, socket, connectionId) {
		this.logger = LogController.createLogger(`Instance/Wrapper/${connectionId}`)

		this.registry = registry
		this.instanceStatus = instanceStatus

		this.socket = socket
		this.connectionId = connectionId
		this.hasHttpHandler = false

		this.unsubListeners = this.#listenToEvents({
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
		})
	}

	/**
	 * Subscribe to all the events defined in the handlers, and wrap with safety and logging
	 * @param {object} handlers
	 * @returns function to unsubscribe the handlers
	 */
	#listenToEvents(handlers) {
		const registeredListeners = {}

		for (const [event, handler] of Object.entries(handlers)) {
			const func = async (msg, cb) => {
				if (!msg || typeof msg !== 'object') {
					this.logger.debug(`Received malformed message object "${event}"`)
					return // Ignore messages without correct structure
				}
				if (cb && typeof cb !== 'function') {
					this.logger.debug(`Received malformed callback "${event}"`)
					return // Ignore messages without correct structure
				}

				try {
					// Run it
					const result = await handler(msg)

					if (cb) cb(null, result)
				} catch (e) {
					this.logger.error(`Command failed: ${e}`, e.stack)
					if (cb) cb(e?.toString() ?? JSON.stringify(e), undefined)
				}
			}
			this.socket.on(event, func)
			registeredListeners[event] = func
		}

		return () => {
			// unsubscribe
			for (const [event, func] of Object.entries(registeredListeners)) {
				this.socket.off(event, func)
			}
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

		const msg = await socketEmit(this.socket, 'init', {
			label: config.label,
			config: config.config,

			lastUpgradeIndex: config.lastUpgradeIndex,

			// Pass all actions and feedbacks for upgrading and initial subscribe calls
			actions: allActions,
			feedbacks: allFeedbacks,
		})

		// Save the resulting values
		this.hasHttpHandler = !!msg.hasHttpHandler
		config.lastUpgradeIndex = msg.newUpgradeIndex
		this.registry.instance.setInstanceLabelAndConfig(this.connectionId, null, msg.updatedConfig, true)
	}

	/**
	 * Forward an updated config object to the instance class
	 * @param {object} config
	 */
	async updateConfig(config) {
		await socketEmit(this.socket, 'updateConfig', config)
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
		const res = await socketEmit(this.socket, 'getConfigFields', {})
		return res.fields
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
			if (control.feedbacks && control.feedbacks.length > 0) {
				const imageSize = control.getBitmapSize()
				for (const feedback of control.feedbacks) {
					const parsed = ParseControlId(controlId)
					if (feedback.instance_id === this.connectionId && parsed?.type === 'bank') {
						allFeedbacks[feedback.id] = {
							id: feedback.id,
							controlId: controlId,
							feedbackId: feedback.type,
							options: feedback.options,

							upgradeIndex: feedback.upgradeIndex,

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

		// Find all the feedbacks in triggers
		const triggerFeedbacks = this.registry.triggers.getAllFeedbacks()
		for (const feedback of triggerFeedbacks) {
			if (feedback.instance_id == this.connectionId) {
				// fbs.push(feedback)
				allFeedbacks[feedback.id] = {
					id: feedback.id,
					controlId: CreateTriggerControlId(feedback.triggerId),
					feedbackId: feedback.type,
					options: feedback.options,

					upgradeIndex: feedback.upgradeIndex,

					// Note: these must be boolen triggers, so some properties are not relevant
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

		await socketEmit(this.socket, 'updateFeedbacks', msg)
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
			if (control.action_sets) {
				for (const set of Object.values(control.action_sets)) {
					for (const action of set) {
						const parsed = ParseControlId(controlId)
						if (action.instance == this.connectionId) {
							allActions[action.id] = {
								id: action.id,
								controlId: controlId,
								actionId: action.action,
								options: action.options,

								upgradeIndex: action.upgradeIndex,

								page: parsed?.page,
								bank: parsed?.bank,
							}
						}
					}
				}
			}
		}

		const triggerActions = this.registry.triggers.getAllActions()
		for (const action of triggerActions) {
			if (action.instance == this.connectionId) {
				allActions[action.id] = {
					id: action.id,
					controlId: CreateTriggerControlId(action.triggerId),
					actionId: action.action,
					options: action.options,

					upgradeIndex: action.upgradeIndex,
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

		await socketEmit(this.socket, 'updateActions', msg)
	}

	/**
	 * Inform the child instance class about an updated feedback
	 * @param {object} feedback
	 * @param {string} controlId
	 */
	async feedbackUpdate(feedback, controlId) {
		if (feedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a diferent instance`)

		const parsedId = ParseControlId(controlId)

		const control = this.registry.controls.getControl(controlId)

		await socketEmit(this.socket, 'updateFeedbacks', {
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
			const msg = await socketEmit(this.socket, 'learnFeedback', {
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

		await socketEmit(this.socket, 'updateFeedbacks', {
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

		const parsedId = ParseControlId(controlId)

		await socketEmit(this.socket, 'updateActions', {
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

		await socketEmit(this.socket, 'updateActions', {
			actions: {
				// Mark as deleted
				[oldAction.id]: null,
			},
		})
	}

	async actionLearnValues(action) {
		try {
			const msg = await socketEmit(this.socket, 'learnAction', {
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
			await socketEmit(this.socket, 'executeAction', {
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
			await socketEmit(this.socket, 'destroy', {})
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

			socketEmit(
				this.socket,
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
		this.logger.log(msg.level, msg.message)
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
		this.registry.instance.variable.setVariableDefinitions(
			this.label,
			msg.variables.map((v) => ({
				label: v.name,
				name: v.id,
			}))
		)
	}

	/**
	 * Handle setting preset definitions from the child process
	 */
	async #handleSetPresetDefinitions(msg) {
		// Convert back to an object
		const presets = {}
		for (const preset of msg.presets) {
			presets[preset.id] = preset
		}

		this.registry.instance.definitions.setPresetDefinitions(this.connectionId, this.label, presets)
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
			const newText = this.registry.instance.variable.parseVariables(msg.text)

			return { text: newText }
		} catch (e) {
			this.logger.error(`Parse variables failed: ${e}`)

			throw new Error(`Failed to parse variables in string`)
		}
	}

	/**
	 * Handle the module informing us of some actions/feedbacks which have been run through upgrade scripts
	 */
	async #handleUpgradedItems(msg) {
		// TODO - we should batch these changes when there are multiple on one control (to void excessive redrawing)

		// TODO - are we missing some type translation here?

		for (const feedback of Object.values(msg.updatedFeedbacks)) {
			if (feedback) {
				const parsedControl = ParseControlId(feedback.controlId)
				if (parsedControl?.type === 'bank') {
					const control = this.registry.controls.getControl(feedback.controlId)
					const found = control?.feedbackReplace?.(feedback) ?? false
					if (!found) {
						this.logger.silly(`Failed to replace upgraded feedback: ${feedback.id} ${feedback.controlId}`)
					}
				} else if (parsedControl?.type === 'trigger') {
					const found = this.registry.triggers.replaceFeedbackItem(parsedControl.trigger, feedback)
					if (!found) {
						this.logger.silly(`Failed to replace upgraded action: ${action.id} ${action.controlId}`)
					}
				} else {
					// Ignore for now
				}
			}
		}
		for (const action of Object.values(msg.updatedActions)) {
			if (action) {
				const parsedControl = ParseControlId(action.controlId)
				if (parsedControl?.type === 'bank') {
					const control = this.registry.controls.getControl(action.controlId)
					const found = control?.actionReplace?.(action) ?? false
					if (!found) {
						this.logger.silly(`Failed to replace upgraded action: ${action.id} ${action.controlId}`)
					}
				} else if (parsedControl?.type === 'trigger') {
					const found = this.registry.triggers.replaceActionItem(parsedControl.trigger, action)
					if (!found) {
						this.logger.silly(`Failed to replace upgraded action: ${action.id} ${action.controlId}`)
					}
				} else {
					// Ignore for now
				}
			}
		}
	}
}

export default SocketEventsHandler
