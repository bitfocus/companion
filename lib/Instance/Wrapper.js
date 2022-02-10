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
		await socketEmit(this.socket, 'init', config)

		// // TODO - send subscribe for actions and properties

		const msg = {
			feedbacks: {},
		}

		this.system.emit('feedbacks_for_instance', this.id, (_result) => {
			for (const feedback of _result) {
				msg.feedbacks[feedback.id] = {
					id: feedback.id,
					//
					feedbackId: feedback.type,
					options: feedback.options,

					id: string
	controlId: string
	feedbackId: string // aka 'type'
	options: { [key: string]: InputValue | undefined }

	/** If control supports an imageBuffer, the dimensions the buffer must be */
	image?: {
		width: number
		height: number
	}

	/** @deprecated */
	page: number
	/** @deprecated */
	bank: number

	/** @deprecated */
	rawBank: any
				}
			}
		})

		// for (const control of controls) {
		// 	const feedbacks = getAllControlDefinitionFeedbacks(control)
		// 	for (const feedback of feedbacks) {
		// 		// Find all the feedbacks that belong to this connection
		// 		if (feedback.connectionId === connectionId) {
		// 			msg.feedbacks[feedback.id] = {
		// 				id: feedback.id,
		// 				controlId: control._id,
		// 				feedbackId: feedback.feedbackId,
		// 				options: feedback.options,
		// 			}
		// 		}
		// 	}
		// }

		// // Send init to the module
		// await socketEmit(socket, 'updateFeedbacks', msg)
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

	// doWorkTask = async (task: IDeviceConnectionWorkTask) => {
	// 	switch (task.task.type) {
	// 		case 'action:execute':
	// 			await socketEmit(socket, 'executeAction', task.task)
	// 			break
	// 		case 'feedback:update':
	// 			await socketEmit(socket, 'updateFeedbacks', {
	// 				feedbacks: {
	// 					[task.task.feedback.id]: {
	// 						id: task.task.feedback.id,
	// 						feedbackId: task.task.feedback.feedbackId,
	// 						controlId: task.task.controlId,
	// 						options: task.task.feedback.options,
	// 					},
	// 				},
	// 			})
	// 			break
	// 		case 'feedback:remove':
	// 			await socketEmit(socket, 'updateFeedbacks', {
	// 				feedbacks: {
	// 					[task.task.feedbackId]: null,
	// 				},
	// 			})
	// 			break
	// 		default:
	// 			assertNever(task.task)
	// 			break
	// 	}
	// }

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
		// 	logger.debug(`Updating feedback values for "${connectionId}" ${msg.values.length} feedbacks`);
		// 	const controlIds = Array.from(new Set(msg.values.map((v) => v.controlId)));
		// 	// Fetch all of the affected controls. This is a race condition, but having some extra feedback values left floating around is unlikely to leak enough to matter
		// 	const controls = await core.models.controlDefinitions.find({ _id: { $in: controlIds } }).toArray();
		// 	try {
		// 		// Make sure the docs exist
		// 		await core.models.controlFeedbackValues.insertMany(
		// 			controls.map((c) => ({
		// 				_id: c._id,
		// 				values: {},
		// 			})),
		// 			{
		// 				ordered: false,
		// 			},
		// 		);
		// 	} catch (_e) {
		// 		// Ignore if already exists
		// 	}
		// 	const writeOps: Array<AnyBulkWriteOperation<IControlFeedbackValue>> = [];
		// 	for (const control of controls) {
		// 		const controlId = control._id;
		// 		const valuesForControl = msg.values.filter((v) => v.controlId === controlId);
		// 		// Figure out what feedbacks are on the control, so we can scope the allowed ids
		// 		const feedbackIds = new Set(getAllControlDefinitionFeedbacks(control).map((f) => f.id));
		// 		const update: UpdateFilter<IControlFeedbackValue> = { $set: {}, $unset: {} };
		// 		for (const value of valuesForControl) {
		// 			// Verify the feedback is known, and lets build the query
		// 			if (feedbackIds.has(value.id)) {
		// 				const key = `values.${value.id}`;
		// 				if (value.value === undefined) {
		// 					update.$unset![key] = 1;
		// 				} else {
		// 					update.$set![key] = value.value;
		// 				}
		// 			}
		// 		}
		// 		if (Object.keys(update.$unset!).length === 0) delete update.$unset;
		// 		if (Object.keys(update.$set!).length === 0) delete update.$set;
		// 		if (Object.keys(update).length !== 0) {
		// 			writeOps.push({
		// 				updateOne: {
		// 					filter: {
		// 						_id: controlId,
		// 					},
		// 					update: update,
		// 				},
		// 			});
		// 		}
		// 	}
		// 	if (writeOps.length > 0) {
		// 		await core.models.controlFeedbackValues.bulkWrite(writeOps);
		// 	}
	}

	async handleSetVariableValues(msg) {
		const variables = {}
		for (const variable of msg.newValues) {
			variables[variable.id] = variable.value
		}

		// this.registry.instance.variable.set_variables(instance.label, variables)
	}

	async handleSetVariableDefinitions(msg) {
		// TODO - label
		// this.registry.instance.variable.setVariableDefinitions(label, )
	}

	async handleSaveConfig(msg) {
		// Save config, but do not automatically call this module's updateConfig again
		this.system.emit('instance_config_put', this.id, msg.config, true)
	}

	async handleSendOsc(msg) {
		// TODO - make sure buffers arent mangled
		this.system.emit('osc_send', msg.host, msg.port, msg.path, msg.args)
	}
}
module.exports = SocketEventsHandler
