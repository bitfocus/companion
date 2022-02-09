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
	constructor(registry, socket, connectionId) {
		this.debug = debug(`lib/Instance/Wrapper/${connectionId}`)

		this.registry = registry
		this.socket = socket
		this.connectionId = connectionId

		this.unsubListeners = this._listenToEvents({
			'log-message': this.handleLogMessage.bind(this),
			'set-status': this.handleSetStatus.bind(this),
			setActionDefinitions: this.handleSetActionDefinitions.bind(this),
			setFeedbackDefinitions: this.handleSetFeedbackDefinitions.bind(this),
			setPropertyDefinitions: this.handleSetPropertyDefinitions.bind(this),
			updateFeedbackValues: this.handleUpdateFeedbackValues.bind(this),
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

		// // Find all the feedbacks that should be sent to the child process
		// // This is not very efficient, but will have to do...
		// const controls = await core.models.controlDefinitions
		// 	.find(getQueryForControlDefinitionUsingFeedbacksWithConnectionId(connectionId))
		// 	.toArray()

		// const msg = {
		// 	feedbacks: {},
		// }

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
		// TODO
	}
	async handleSetStatus(msg) {
		this.debug(`Updating status`)
		// 	await core.models.deviceConnectionStatuses.replaceOne(
		// 		{ _id: connectionId },
		// 		{
		// 			_id: connectionId,
		// 			status: msg.status,
		// 			message: msg.message,
		// 		},
		// 		{ upsert: true },
		// 	);
	}
	async handleSetActionDefinitions(msg) {
		// 	logger.debug(`Updating actions for "${connectionId}"`);
		// 	const writeOps: Array<Mongo.AnyBulkWriteOperation<IDeviceConnectionAction>> = [];
		// 	const knownIds: string[] = [];
		// 	for (const action of msg.actions) {
		// 		const doc: IDeviceConnectionAction = {
		// 			_id: getHash(`${connectionId}:${action.id}`),
		// 			connectionId: connectionId,
		// 			actionId: action.id,
		// 			// TODO - more conversion
		// 			name: action.name,
		// 			description: action.description,
		// 			options: action.options,
		// 		};
		// 		knownIds.push(doc._id);
		// 		writeOps.push({
		// 			replaceOne: {
		// 				filter: {
		// 					_id: doc._id,
		// 				},
		// 				replacement: doc,
		// 				upsert: true,
		// 			},
		// 		});
		// 	}
		// 	logger.debug(`Got ${writeOps.length} actions`);
		// 	// TODO - block concurrent operations?
		// 	await core.models.deviceConnectionActions.bulkWrite([
		// 		...writeOps,
		// 		{
		// 			deleteMany: {
		// 				filter: {
		// 					connectionId: connectionId,
		// 					_id: {
		// 						$nin: knownIds,
		// 					},
		// 				},
		// 			},
		// 		},
		// 	]);
		// 	logger.debug(`Updated actions`);
	}

	async handleSetFeedbackDefinitions(msg) {
		// 	logger.debug(`Updating feedbacks for "${connectionId}"`);
		// 	const writeOps: Array<Mongo.AnyBulkWriteOperation<IDeviceConnectionFeedback>> = [];
		// 	const knownIds: string[] = [];
		// 	for (const feedback of msg.feedbacks) {
		// 		const doc: IDeviceConnectionFeedback = {
		// 			_id: getHash(`${connectionId}:${feedback.id}`),
		// 			connectionId: connectionId,
		// 			feedbackId: feedback.id,
		// 			// TODO - more conversion
		// 			type: feedback.type,
		// 			name: feedback.name,
		// 			description: feedback.description,
		// 			options: feedback.options,
		// 		};
		// 		knownIds.push(doc._id);
		// 		writeOps.push({
		// 			replaceOne: {
		// 				filter: {
		// 					_id: doc._id,
		// 				},
		// 				replacement: doc,
		// 				upsert: true,
		// 			},
		// 		});
		// 	}
		// 	logger.debug(`Got ${writeOps.length} feedbacks`);
		// 	// TODO - block concurrent operations?
		// 	await core.models.deviceConnectionFeedbacks.bulkWrite([
		// 		...writeOps,
		// 		{
		// 			deleteMany: {
		// 				filter: {
		// 					connectionId: connectionId,
		// 					_id: {
		// 						$nin: knownIds,
		// 					},
		// 				},
		// 			},
		// 		},
		// 	]);
		// 	logger.debug(`Updated feedbacks`);
	}

	async handleSetPropertyDefinitions(msg) {
		// 	logger.debug(`Updating properties for "${connectionId}"`);
		// 	const writeOps: Array<Mongo.AnyBulkWriteOperation<IDeviceConnectionProperty>> = [];
		// 	const knownIds: string[] = [];
		// 	for (const property of msg.properties) {
		// 		const doc: IDeviceConnectionProperty = {
		// 			_id: getHash(`${connectionId}:${property.id}`),
		// 			connectionId: connectionId,
		// 			propertyId: property.id,
		// 			name: property.name,
		// 			description: property.description,
		// 			instanceIds: property.instanceIds,
		// 			valueInput: property.valueField,
		// 			hasSubscribe: property.hasSubscribe,
		// 		};
		// 		knownIds.push(doc._id);
		// 		writeOps.push({
		// 			replaceOne: {
		// 				filter: {
		// 					_id: doc._id,
		// 				},
		// 				replacement: doc,
		// 				upsert: true,
		// 			},
		// 		});
		// 	}
		// 	logger.debug(`Got ${writeOps.length} properties`);
		// 	// TODO - block concurrent operations?
		// 	await core.models.deviceConnectionProperties.bulkWrite([
		// 		...writeOps,
		// 		{
		// 			deleteMany: {
		// 				filter: {
		// 					connectionId: connectionId,
		// 					_id: {
		// 						$nin: knownIds,
		// 					},
		// 				},
		// 			},
		// 		},
		// 	]);
		// 	logger.debug(`Updated properties`);
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
}
module.exports = SocketEventsHandler
