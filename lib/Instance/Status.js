import CoreBase from '../Core/Base.js'

class Status extends CoreBase {
	constructor(registry) {
		super(registry, 'instance', 'Instance/Status')

		// levels: null = unknown, see updateInstanceStatus for possible values
		this.instance_statuses = {}
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('instance_status_get', () => {
			client.emit('instance_status', this.instance_statuses)
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
				category = 'error'
			case 'unknown_error':
				break
			case 'bad_config':
			case 'unknown_warning':
			default:
				category = 'warning'
				break
		}

		this.instance_statuses[instance_id] = {
			category: category,
			level: level,
			message: msg,
		}
		this.internalModule.calculateInstanceErrors(this.instance_statuses)

		this.io.emit('instance_status', this.instance_statuses)
		this.bank.action.checkAllStatus()
	}

	/**
	 * Get the status of an instance
	 * @param {String} instance_id
	 * @returns {number} ??
	 */
	getInstanceStatus(instance_id) {
		return this.instance_statuses[instance_id]
	}

	forgetInstanceStatus(instance_id) {
		delete this.instance_statuses[instance_id]
	}
}

export default Status
