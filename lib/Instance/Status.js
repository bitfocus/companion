import jsonPatch from 'fast-json-patch'
import { isEqual } from 'lodash-es'
import CoreBase from '../Core/Base.js'

class Status extends CoreBase {
	/**
	 * The latest statuses object
	 * levels: null = unknown, see updateInstanceStatus for possible values
	 * @access private
	 */
	#instanceStatuses = {}

	constructor(registry) {
		super(registry, 'instance', 'Instance/Status')
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('instance_status:get', () => {
			return this.#instanceStatuses
		})
	}

	/**
	 * Update the status of an instance
	 * @param {String} instance_id
	 * @param {number | null} level
	 * @param {String | null} msg
	 */
	updateInstanceStatus(instance_id, level, msg) {
		let category = 'warning'

		switch (level) {
			case null:
				category = null
				break
			case 'ok':
				category = 'good'
				break
			case 'connecting':
			case 'disconnected':
			case 'connection_failure':
			case 'crashed':
			case 'unknown_error':
				category = 'error'
				break
			case 'bad_config':
			case 'unknown_warning':
			default:
				category = 'warning'
				break
		}

		const newStatuses = { ...this.#instanceStatuses }
		newStatuses[instance_id] = {
			category: category,
			level: level,
			message: msg?.toString?.(),
		}

		if (!isEqual(newStatuses[instance_id], this.#instanceStatuses[instance_id])) {
			this.internalModule.calculateInstanceErrors(newStatuses)

			this.controls.checkAllStatus()

			this.#setStatuses(newStatuses)
		}
	}

	/**
	 * Get the status of an instance
	 * @param {String} instance_id
	 * @returns {object} ??
	 */
	getInstanceStatus(instance_id) {
		return this.#instanceStatuses[instance_id]
	}

	forgetInstanceStatus(instance_id) {
		const newStatuses = { ...this.#instanceStatuses }
		delete newStatuses[instance_id]

		this.#setStatuses(newStatuses)
	}

	#setStatuses(newObj) {
		const patch = jsonPatch.compare(this.#instanceStatuses || {}, newObj || {})
		if (patch.length > 0) {
			this.io.emit(`instance_status:patch`, patch)
		}

		this.#instanceStatuses = newObj
	}
}

export default Status
