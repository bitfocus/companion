import LogController from '../Log/Controller.js'
import PTimeout from 'p-timeout'

async function socketEmit(socket, name, msg) {
	const p = new Promise((resolve, reject) => {
		const innerCb = (err, res) => {
			if (err) reject(err)
			else resolve(res)
		}
		socket.emit(name, msg, innerCb)
	})

	return PTimeout(p, 5000, `Message to module "${name}" timed out`)
}

class SocketEventsHandler {
	constructor(registry, instanceStatus, socket, connectionId) {
		this.logger = LogController.createLogger(`Instance/Wrapper/${connectionId}`)

		this.registry = registry
		this.instanceStatus = instanceStatus

		this.socket = socket
		this.connectionId = connectionId

		this.unsubListeners = this.#listenToEvents({
			'log-message': this.#handleLogMessage.bind(this),
			'set-status': this.#handleSetStatus.bind(this),
			setActionDefinitions: this.#handleSetActionDefinitions.bind(this),
			setFeedbackDefinitions: this.#handleSetFeedbackDefinitions.bind(this),
			setVariableDefinitions: this.#handleSetVariableDefinitions.bind(this),
			setPresetDefinitions: this.#handleSetPresetDefinitions.bind(this),
			updateFeedbackValues: this.#handleUpdateFeedbackValues.bind(this),
			setVariableValues: this.#handleSetVariableValues.bind(this),
			saveConfig: this.#handleSaveConfig.bind(this),
			'send-osc': this.#handleSendOsc.bind(this),
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
	async init(label, config) {
		this.label = label
		await socketEmit(this.socket, 'init', config)

		// Send current actions and feedbacks for subscriptions/monitoring
		await this.sendAllFeedbackInstances()
		await this.#sendAllActionInstances()
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
	 * Send all feedback instances to the child process
	 * @access public - needs to be re-run when the topbar setting changes
	 */
	async sendAllFeedbackInstances() {
		const msg = {
			feedbacks: {},
		}

		// This function gets called when the topbar status changes, so we can 'hardcode' the current state of these
		let imageSize = { width: 72, height: 58 }
		if (this.registry.userconfig.getKey('remove_topbar') === true) {
			imageSize = {
				width: 72,
				height: 72,
			}
		}

		let banks = this.registry.bank.getAll()

		// Find all the feedbacks on banks
		const all_bank_feedbacks = this.registry.bank.feedback.getAll()

		for (const page in all_bank_feedbacks) {
			for (const bank in all_bank_feedbacks[page]) {
				for (const feedback of all_bank_feedbacks[page][bank]) {
					if (feedback.instance_id === this.connectionId) {
						msg.feedbacks[feedback.id] = {
							id: feedback.id,
							controlId: `bank:${page}-${bank}`, // A temporary identifier
							feedbackId: feedback.type,
							options: feedback.options,

							image: imageSize,
							page: page,
							bank: bank,

							// Pass the current default style for compatability reasons
							rawBank: banks?.[page]?.[bank],
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
				msg.feedbacks[feedback.id] = {
					id: feedback.id,
					controlId: feedback.triggerId,
					feedbackId: feedback.type,
					options: feedback.options,

					// Note: these must be boolen triggers, so some properties are not relevant
				}
			}
		}

		await socketEmit(this.socket, 'updateFeedbacks', msg)
	}

	/**
	 * Send all action instances to the child process
	 * @access private
	 */
	async #sendAllActionInstances() {
		const msg = {
			actions: {},
		}

		this.registry.bank.action.iterateActions((action, page, bank) => {
			if (action.instance == this.connectionId) {
				msg.actions[action.id] = {
					id: action.id,
					controlId: `bank:${page}-${bank}`, // A temporary identifier
					actionId: action.action,
					options: action.options,

					page: page,
					bank: bank,
				}
			}
		})

		const triggerActions = this.registry.triggers.getAllActions()
		for (const action of triggerActions) {
			if (action.instance == this.connectionId) {
				msg.actions[action.id] = {
					id: action.id,
					controlId: action.triggerId,
					actionId: action.action,
					options: action.options,
				}
			}
		}

		await socketEmit(this.socket, 'updateActions', msg)
	}

	/**
	 * Inform the child instance class about an updated feedback
	 * @param {object} feedback
	 * @param {number} page
	 * @param {number} bank
	 */
	async feedbackUpdate(feedback, controlId, page, bank) {
		if (feedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a diferent instance`)

		// Feedbacks get resent when the topbar status changes, so we can 'hardcode' the current state
		let imageSize = { width: 72, height: 58 }
		if (this.registry.userconfig.getKey('remove_topbar') === true) {
			imageSize = {
				width: 72,
				height: 72,
			}
		}

		let page_banks = page !== undefined ? this.registry.bank.getPageBanks(page) : undefined

		await socketEmit(this.socket, 'updateFeedbacks', {
			feedbacks: {
				[feedback.id]: {
					id: feedback.id,
					controlId: controlId,
					feedbackId: feedback.type,
					options: feedback.options,

					image: imageSize,
					page: page,
					bank: bank,

					// Pass the current default style for compatability reasons
					rawBank: page_banks?.[bank],
				},
			},
		})
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
	 * @param {number} page
	 * @param {number} bank
	 */
	async actionUpdate(action, page, bank) {
		if (action.instance !== this.connectionId) throw new Error(`Action is for a diferent instance`)

		await socketEmit(this.socket, 'updateActions', {
			actions: {
				[action.id]: {
					id: action.id,
					controlId: `bank:${page}-${bank}`, // A temporary identifier
					actionId: action.action,
					options: action.options,

					page: page,
					bank: bank,
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

	/**
	 * Tell the child instance class to execute an action
	 * @param {object} action
	 * @param {object} extras
	 */
	async actionRun(action, extras) {
		if (action.instance !== this.connectionId) throw new Error(`Action is for a diferent instance`)

		await socketEmit(this.socket, 'executeAction', {
			action: {
				id: action.id,
				controlId: `bank:${extras?.page}-${extras?.bank}`, // A temporary identifier
				actionId: action.action,
				options: action.options,

				page: extras?.page,
				bank: extras?.bank,
			},

			deviceId: extras?.deviceid,
		})
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
		this.logger.silly(`Updating status`)

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

		this.registry.bank.action.setActionDefinitions(this.connectionId, actions)
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

		this.registry.bank.feedback.setDefinitions(this.connectionId, feedbacks)
	}

	/**
	 * Handle updating feedback values from the child process
	 */
	async #handleUpdateFeedbackValues(msg) {
		this.registry.bank.feedback.updateFeedbackValues(this.connectionId, msg.values)
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
		this.registry.instance.preset.setPresetDefinitions(this.connectionId, this.label, msg.presets)
	}

	/**
	 * Handle saving an updated config object from the child process
	 */
	async #handleSaveConfig(msg) {
		// Save config, but do not automatically call this module's updateConfig again
		this.registry.instance.setInstanceLabelAndConfig(this.id, null, msg.config, true)
	}

	/**
	 * Handle sending an osc message from the child process
	 */
	async #handleSendOsc(msg) {
		this.registry.services.oscSender.send(msg.host, msg.port, msg.path, msg.args)
	}
}

export default SocketEventsHandler
