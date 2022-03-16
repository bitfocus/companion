import CoreBase from '../Core/Base.js'

class Status extends CoreBase {
	constructor(registry) {
		super(registry, 'instance', 'lib/Instance/Status')

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
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

	calculateInstanceErrors() {
		let numError = 0
		let numWarn = 0
		let numOk = 0

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		for (const i in this.instance_statuses) {
			let inn = this.instance_statuses[i]

			if (inn[0] === 0) {
				numOk++
			} else if (inn[0] === 1) {
				numWarn++
			} else if (inn[0] === 2) {
				numError++
			}
		}

		this.system.emit('instance_errorcount', [numOk, numWarn, numError, this.instance_statuses])
	}

	/**
	 * Update the status of an instance
	 * @param {String} instance_id
	 * @param {number | null} level
	 * @param {String | null} msg
	 */
	updateInstanceStatus(instance_id, level, msg) {
		this.instance_statuses[instance_id] = [level, msg]
		this.calculateInstanceErrors()

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
