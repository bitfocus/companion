import jsonPatch from 'fast-json-patch'
import { isEqual } from 'lodash-es'
import LogController from '../Log/Controller.js'
import { EventEmitter } from 'events'

/**
 * @typedef {import('../Shared/Model/Common.js').ConnectionStatusEntry} StatusEntry
 */

export default class Status extends EventEmitter {
	/**
	 * The latest statuses object
	 * levels: null = unknown, see updateInstanceStatus for possible values
	 * @type {Record<string, StatusEntry>}
	 * @access private
	 */
	#instanceStatuses = {}

	/**
	 * @type {import('winston').Logger}
	 * @access private
	 * @readonly
	 */
	// @ts-ignore
	#logger = LogController.createLogger('Instance/Status')

	/**
	 * @type {import('../UI/Handler.js').default}
	 * @access private
	 * @readonly
	 */
	#io

	/**
	 * @type {import('../Controls/Controller.js').default}
	 * @access private
	 * @readonly
	 */
	#controls

	/**
	 * @param {import('../UI/Handler.js').default} io
	 * @param {import('../Controls/Controller.js').default} controls
	 */
	constructor(io, controls) {
		super()

		this.#io = io
		this.#controls = controls
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('connections:get-statuses', () => {
			return this.#instanceStatuses
		})
	}

	/**
	 * Update the status of a connection
	 * @param {string} connectionId
	 * @param {string | null} level
	 * @param {string | null} msg
	 */
	updateInstanceStatus(connectionId, level, msg) {
		/** @type {string | null} */
		let category = 'warning'

		switch (level) {
			case null:
				category = null
				break
			case 'ok':
				category = 'good'
				break
			case 'connecting':
				category = 'error'
				level = 'Connecting'
				break
			case 'disconnected':
				category = 'error'
				level = 'Disconnected'
				break
			case 'connection_failure':
				category = 'error'
				level = 'Connection Failure'
				break
			case 'crashed':
				category = 'error'
				level = 'Crashed'
				break
			case 'unknown_error':
				category = 'error'
				level = 'ERROR'
				break
			case 'bad_config':
				category = 'warning'
				level = 'Bad Configuration'
				break
			case 'unknown_warning':
				category = 'warning'
				level = 'Warning'
				break
			case 'initializing':
				category = 'warning'
				level = 'Initializing'
				break
			default:
				category = 'warning'
				break
		}

		const newStatuses = { ...this.#instanceStatuses }
		newStatuses[connectionId] = {
			category: category,
			level: level,
			message: msg?.toString?.(),
		}

		if (!isEqual(newStatuses[connectionId], this.#instanceStatuses[connectionId])) {
			this.#setStatuses(newStatuses)

			this.emit('status_change', newStatuses)

			this.#controls.checkAllStatus()
		}
	}

	/**
	 * Get the status of an instance
	 * @param {String} connectionId
	 * @returns {StatusEntry}
	 */
	getConnectionStatus(connectionId) {
		return this.#instanceStatuses[connectionId]
	}

	/**
	 * Forget the status of an instance
	 * @param {string} connectionId
	 */
	forgetConnectionStatus(connectionId) {
		const newStatuses = { ...this.#instanceStatuses }
		delete newStatuses[connectionId]

		this.#setStatuses(newStatuses)

		this.emit('status_change', newStatuses)

		this.#controls.checkAllStatus()
	}

	/**
	 * Helper to update the statuses
	 * @param {Record<string, StatusEntry>} newObj
	 */
	#setStatuses(newObj) {
		const patch = jsonPatch.compare(this.#instanceStatuses || {}, newObj || {})
		if (patch.length > 0) {
			// TODO - make this be a subscription with a dedicated room
			this.#io.emit(`connections:patch-statuses`, patch)
		}

		this.#instanceStatuses = newObj
	}
}
