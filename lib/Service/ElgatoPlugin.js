import ServiceBase from './Base.js'
import { WebSocketServer } from 'ws'

/**
 * Class providing the Elgato Plugin service.
 *
 * @extends ServiceBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.3.0
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
class ServiceElgatoPlugin extends ServiceBase {
	/**
	 * The port to open the socket with.  Default: <code>28492</code>
	 * @type {number}
	 * @access protected
	 */
	port = 28492

	/**
	 * @param {Registry} registry - the application's core
	 */
	constructor(registry) {
		super(registry, 'elgato-plugin', 'Service/ElgatoPlugin', 'elgato_plugin_enable')

		this.graphics.on('bank_invalidated', this.handleBankChanged.bind(this))

		this.init()
	}

	/**
	 * Close the socket before deleting it
	 * @access protected
	 */
	close() {
		if (this.server) {
			this.logger.info('Shutting down')

			for (const client of this.server.clients) {
				client.terminate()
			}

			this.server.close()
			delete this.server
		}
	}

	/**
	 *
	 * @param {string} page - the page number
	 * @param {string} bank - the bank number
	 */
	handleBankChanged(page, bank, render) {
		page = parseInt(page)
		bank = parseInt(bank) - 1

		if (this.client && this.client.button_listeners) {
			if (this.client.button_listeners.has(`${page}_${bank}`)) {
				this.client.apicommand('fillImage', { page: page, bank: bank, keyIndex: bank, data: render.buffer })
			}
		}
	}

	/**
	 * Setup the socket for v2 API
	 * @param {Socket} socket - the client socket
	 */
	initAPI2(socket) {
		this.logger.silly('init api v2')
		socket.once('new_device', (id) => {
			this.logger.silly('add device: ' + socket.remoteAddress, id)

			// Use ip right now, since the pluginUUID is new on each boot and makes Companion
			// forget all settings for the device. (page and orientation)
			id = 'elgato_plugin-' + socket.remoteAddress

			this.surfaces.addElgatoPluginDevice(id, socket)

			socket.apireply('new_device', { result: true })

			socket.button_listeners = new Set()

			this.client = socket

			socket.on('close', () => {
				delete socket.button_listeners
				this.surfaces.removeDevice(id)
				socket.removeAllListeners('keyup')
				socket.removeAllListeners('keydown')
				delete this.client
			})
		})

		socket.on('request_button', (args) => {
			this.logger.silly('request_button: ', args)

			socket.button_listeners.add(`${args.page}_${args.bank}`)

			socket.apireply('request_button', { result: 'ok' })

			this.handleBankChanged(
				args.page,
				parseInt(args.bank) + 1,
				this.graphics.getBank(args.page, parseInt(args.bank) + 1)
			)
		})

		socket.on('unrequest_button', (args) => {
			this.logger.silly('unrequest_button: ', args)

			socket.button_listeners.delete(`${args.page}_${args.bank}`)

			socket.apireply('request_button', { result: 'ok' })
		})
	}

	/**
	 * Setup the socket processing and rig the appropriate version processing
	 * @param {Socket} socket - the client socket
	 */
	initSocket(socket) {
		socket.apireply = this.socketResponse.bind(this, socket)
		socket.apicommand = this.socketCommand.bind(this, socket)

		socket.on('version', (args) => {
			if (args.version > 2) {
				// Newer than current api version
				socket.apireply('version', { version: 2, error: 'cannot continue' })
				socket.close()
			} else if (args.version === 1) {
				// We don't support v1 anymore
				socket.apireply('version', { version: 2, error: 'no longer supported' })
				socket.close()
			} else {
				socket.apireply('version', { version: 2 })

				this.initAPI2(socket)
			}
		})
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.portConfig !== undefined) {
			this.port = this.userconfig.getKey(this.portConfig)
		}

		if (this.server === undefined) {
			try {
				this.server = new WebSocketServer({
					port: this.port,
				})

				this.server.on('connection', this.processIncoming.bind(this))

				this.currentState = true
				this.logger.info('Listening on port ' + this.port)
			} catch (e) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	/**
	 * Set up a new socket connection
	 * @param {WebSocketRequest} req - the request
	 */
	processIncoming(socket) {
		this.logger.silly('New connection from ' + socket.remoteAddress)

		this.initSocket(socket)

		socket.on('message', (message) => {
			try {
				let data = JSON.parse(message.toString())
				socket.emit(data.command, data.arguments)
				//this.logger.silly('emitting command ' + data.command);
			} catch (e) {
				this.logger.silly('protocol error:', e)
			}
		})

		socket.on('close', () => {
			this.logger.silly('Connection from ' + socket.remoteAddress + ' disconnected')
		})
	}

	/**
	 * Package and send a command
	 * @param {Socket} socket - the client socket
	 * @param {string} command - the command
	 * @param {Object} args - arguemtns for the command
	 */
	socketCommand(socket, command, args) {
		socket.send(JSON.stringify({ command: command, arguments: args }))
	}

	/**
	 * Package and send a response
	 * @param {Socket} socket - the client socket
	 * @param {string} command - the command
	 * @param {Object} args - arguemtns for the command
	 */
	socketResponse(socket, command, args) {
		socket.send(JSON.stringify({ response: command, arguments: args }))
	}
}

export default ServiceElgatoPlugin
