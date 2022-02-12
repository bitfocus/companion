const debug = require('debug')
const PTimeout = require('p-timeout')

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
		this.debug = debug(`lib/Instance/Wrapper/${connectionId}`)

		this.registry = registry
		this.instanceStatus = instanceStatus

		this.socket = socket
		this.connectionId = connectionId

		this.unsubListeners = this._listenToEvents({
			'log-message': this.handleLogMessage.bind(this),
			'set-status': this.handleSetStatus.bind(this),
			setActionDefinitions: this.handleSetActionDefinitions.bind(this),
			setFeedbackDefinitions: this.handleSetFeedbackDefinitions.bind(this),
			setVariableDefinitions: this.handleSetVariableDefinitions.bind(this),
			updateFeedbackValues: this.handleUpdateFeedbackValues.bind(this),
			setVariableValues: this.handleSetVariableValues.bind(this),
			saveConfig: this.handleSaveConfig.bind(this),
			'send-osc': this.handleSendOsc.bind(this),
		})
	}

	/** Subscribe to all the events defined in the handlers, and wrap with safety and logging */
	_listenToEvents(handlers) {
		const registeredListeners = {}

		for (const [event, handler] of Object.entries(handlers)) {
			const func = async (msg, cb) => {
				if (!msg || typeof msg !== 'object') {
					this.debug(`Received malformed message object "${event}"`)
					return // Ignore messages without correct structure
				}
				if (cb && typeof cb !== 'function') {
					this.debug(`Received malformed callback "${event}"`)
					return // Ignore messages without correct structure
				}

				try {
					// Run it
					const result = await handler(msg)

					if (cb) cb(null, result)
				} catch (e) {
					console.error(`Command failed: ${e}`)
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

	async init(config) {
		this.label = config.label
		await socketEmit(this.socket, 'init', config)

		// Send current actions and feedbacks for subscriptions/monitoring
		await this.sendAllFeedbackInstances()
		await this.sendAllActionInstances()
	}

	async updateConfig(config) {
		this.label = config.label
		await socketEmit(this.socket, 'updateConfig', config)
	}

	async requestConfigFields() {
		const res = await socketEmit(this.socket, 'getConfigFields', {})
		return res.fields
	}

	async sendAllFeedbackInstances() {
		const msg = {
			feedbacks: {},
		}

		let imageSize = { width: 72, height: 58 }
		if (this.registry.userconfig.getKey('remove_topbar') === true) {
			imageSize = {
				width: 72,
				height: 72,
			}
		}
		// TODO - need to inform modules when image size changes

		// Find all the feedbacks on banks
		this.registry.system.emit('feedback_getall', (all_bank_feedbacks) => {
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

								// TODO
								// rawBank: any
							}
						}
					}
				}
			}
		})

		// Find all the feedbacks in triggers
		this.registry.system.emit('schedule_get_all_feedbacks', (scheduler_feedbacks) => {
			for (const feedback of scheduler_feedbacks) {
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
		})

		await socketEmit(this.socket, 'updateFeedbacks', msg)
	}

	async sendAllActionInstances() {
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

		this.registry.system.emit('schedule_get_all_actions', (_actions) => {
			for (const action of _actions) {
				if (action.instance == this.connectionId) {
					msg.actions[action.id] = {
						id: action.id,
						controlId: action.triggerId,
						actionId: action.action,
						options: action.options,
					}
				}
			}
		})

		await socketEmit(this.socket, 'updateActions', msg)
	}

	async feedbackUpdate(feedback, page, bank) {
		if (feedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a diferent instance`)

		let imageSize = { width: 72, height: 58 }
		if (this.registry.userconfig.getKey('remove_topbar') === true) {
			imageSize = {
				width: 72,
				height: 72,
			}
		}

		await socketEmit(this.socket, 'updateFeedbacks', {
			feedbacks: {
				[feedback.id]: {
					id: feedback.id,
					controlId: `bank:${page}-${bank}`, // A temporary identifier
					feedbackId: feedback.type,
					options: feedback.options,

					image: imageSize,
					page: page,
					bank: bank,

					// TODO
					// rawBank: any
				},
			},
		})
	}
	async feedbackDelete(oldFeedback) {
		if (oldFeedback.instance_id !== this.connectionId) throw new Error(`Feedback is for a diferent instance`)

		await socketEmit(this.socket, 'updateFeedbacks', {
			feedbacks: {
				// Mark as deleted
				[oldFeedback.id]: null,
			},
		})
	}

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
	async actionDelete(oldAction) {
		if (oldAction.instance !== this.connectionId) throw new Error(`Action is for a diferent instance`)

		await socketEmit(this.socket, 'updateActions', {
			actions: {
				// Mark as deleted
				[oldAction.id]: null,
			},
		})
	}
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

	async destroy() {
		// Cleanup the system once the module is destroyed

		try {
			await socketEmit(this.socket, 'destroy', {})
		} catch (e) {
			console.warn(`Destroy for "${this.connectionId}" errored: ${e}`)
		}

		// Stop socket.io commands being received
		unsubListeners()

		// TODO - wait for any in progress commands to be completed?

		// // Cleanup any db collections
		// await Promise.allSettled([
		// 	core.models.deviceConnectionActions.deleteMany({ connectionId: connectionId }),
		// 	core.models.deviceConnectionFeedbacks.deleteMany({ connectionId: connectionId }),
		// 	core.models.deviceConnectionProperties.deleteMany({ connectionId: connectionId }),
		// 	core.models.deviceConnectionStatuses.deleteOne({ _id: connectionId }),
		// ])
	}

	async handleLogMessage(msg) {
		const label = 'TODO' // TODO
		this.registry.system.emit('log', 'instance(' + label + ')', msg.level, msg.message)
	}
	async handleSetStatus(msg) {
		this.debug(`Updating status`)

		this.instanceStatus.updateInstanceStatus(this.connectionId, msg.status, msg.message)
	}

	async handleSetActionDefinitions(msg) {
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

	async handleSetFeedbackDefinitions(msg) {
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

		this.registry.bank.feedback.setFeedbackDefinitions(this.connectionId, feedbacks)
	}

	async handleUpdateFeedbackValues(msg) {
		this.registry.bank.feedback.updateFeedbackValues(this.connectionId, msg.values)
	}

	async handleSetVariableValues(msg) {
		const variables = {}
		for (const variable of msg.newValues) {
			variables[variable.id] = variable.value
		}

		this.registry.instance.variable.set_variables(this.label, variables)
	}

	async handleSetVariableDefinitions(msg) {
		this.registry.instance.variable.setVariableDefinitions(
			this.label,
			msg.variables.map((v) => ({
				label: v.name,
				name: v.id,
			}))
		)
	}

	async handleSaveConfig(msg) {
		// Save config, but do not automatically call this module's updateConfig again
		this.system.emit(
			'instance_config_put',
			this.id,
			{
				...msg.config,
				// Make sure module doesnt try to change its label
				label: this.label,
			},
			true
		)
	}

	async handleSendOsc(msg) {
		// TODO - make sure buffers arent mangled
		this.system.emit('osc_send', msg.host, msg.port, msg.path, msg.args)
	}
}
module.exports = SocketEventsHandler
