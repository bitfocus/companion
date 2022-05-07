import UIHandler from './Handler.js'
import { cloneDeep } from 'lodash-es'
import createDebug from 'debug'

/**
 * Logger for messages to send to the user in the UI
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.12
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class UILog {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = createDebug('lib/UI/Log')
	/**
	 * The log array
	 * @type {Array[]}
	 * @access protected
	 */
	history = []
	/**
	 * The core interface client
	 * @type {UIHandler}
	 * @access protected
	 */
	io

	/**
	 * Create a new UI logger
	 * @param {Registry} registry - the core application
	 * @param {UIHandler} io - the core interface client
	 */
	constructor(registry, io) {
		this.registry = registry
		this.io = io
		this.history.push([Date.now(), 'log', 'info', 'Application started'])
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.on('log_clear', () => {
			client.broadcast.emit('log_clear')
			this.history = []
			this.io.emit('log', Date.now(), 'log', 'info', 'Log cleared')
		})
		client.on('log_catchup', (cb) => {
			cb(this.history)
		})
	}

	/**
	 * Log and send a message to the UI
	 * @param {string} source - the name of the module sending the log
	 * @param {string} level - 'debug' | 'info' | 'warn' | 'error'
	 * @param {string} message - the message to print
	 * @access public
	 */
	add(source, level, message) {
		if (level) {
			let now = Date.now()
			this.io.emit('log', now, source, level, message)
			this.history.push([now, source, level, message])
			if (this.history.length > 2000) {
				this.history.shift()
			}
		}
	}

	/**
	 * Get all of the log entries
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a reference
	 * @return {Array[]} the log entries
	 * @access public
	 */
	getAll(clone = false) {
		let out
		this.debug(`get all`)

		if (clone === true) {
			out = cloneDeep(this.history)
		} else {
			out = this.history
		}

		return out
	}
}

export default UILog
