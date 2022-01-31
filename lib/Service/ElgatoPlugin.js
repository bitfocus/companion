/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

const http = require('http')
const { server: WebSocketServer } = require('websocket')
const CoreBase = require('../Core/Base')

function socketResponse(command, args) {
	this.sendUTF(JSON.stringify({ response: command, arguments: args }))
}
function socketCommand(command, args) {
	this.sendUTF(JSON.stringify({ command: command, arguments: args }))
}

class ServiceElgatoPlugin extends CoreBase {
	constructor(registry) {
		super(registry, 'elgato-plugin', 'lib/Service/ElgatoPlugin')

		this.system.emit('elgatodm_get', (_elgatoDM) => {
			this.elgatoDM = _elgatoDM
		})

		this.system.emit('db_get', 'instance', (res) => {
			this.instances = res
		})

		this.system.on('graphics_bank_invalidated', (page, button) => {
			this.handleBankChanged(page, button)
		})

		let user_config = {}
		this.system.emit('db_get', 'userconfig', (config) => {
			user_config = config || {}
		})

		if (user_config.elgato_plugin_enable) {
			this.start_listening()
		}

		this.system.on('set_userconfig_key', (key, value) => {
			if (key == 'elgato_plugin_enable') {
				// start/stop listener
				if (value && !this.http) {
					this.start_listening()
				} else if (!value && this.http) {
					this.stop_listening()
				}
			}
		})
	}

	start_listening() {
		if (this.http || this.ws) {
			// cleanup an old server first
			this.stop_listening()
		}

		const port = 28492

		this.http = http.createServer((request, response) => {
			response.writeHead(404)
			response.end('Not found')
		})
		this.http.on('error', (err) => {
			this.debug(`ERROR opening port ${port} for elgato plugin`, err)
			this.system.emit('log', 'Elgato Plugin', 'error', `Couldn't bind to Elgato Plugin port ${port}`)
		})
		this.http.listen(port, () => {
			this.debug('elgato plugin ready')
			this.system.emit('log', 'Elgato Plugin', 'info', `Listening for Elgato Plugin commands`)
		})

		this.ws = new WebSocketServer({
			httpServer: this.http,
			autoAcceptConnections: false,
		})

		this.ws.on('request', (req) => {
			const socket = req.accept('', req.origin)
			this.debug('New connection from ' + socket.remoteAddress)

			this.initSocket(socket)

			socket.on('message', (message) => {
				if (message.type == 'utf8') {
					try {
						let data = JSON.parse(message.utf8Data)
						socket.emit(data.command, data.arguments)
						//this.debug('emitting command ' + data.command);
					} catch (e) {
						this.debug('protocol error:', e)
					}
				}
			})

			socket.on('close', () => {
				this.debug('Connection from ' + socket.remoteAddress + ' disconnected')
			})
		})
	}

	stop_listening() {
		this.debug(`Stopping eglato plugin server`)
		this.system.emit('log', 'Elgato Plugin', 'info', `Stopping listening for Elgato Plugin commands`)

		if (this.ws) {
			this.ws.shutDown()
			delete this.ws
		}

		if (this.http) {
			this.http.close()
			delete this.http
		}
	}

	initAPI1(socket) {
		this.debug('init api')
		socket.once('new_device', (id) => {
			this.debug('add device: ' + socket.remoteAddress, id)

			// Use ip right now, since the pluginUUID is new on each boot and makes Companion
			// forget all settings for the device. (page and orientation)
			id = 'elgato_plugin-' + socket.remoteAddress

			this.elgatoDM.addDevice({ path: id }, 'streamdeck_plugin')

			// Give elgato_plugin reference to socket
			this.system.emit(id + '_plugin_startup', socket)

			socket.apireply('new_device', { result: true })

			socket.on('get_instances', (args) => {
				socket.apireply('get_instances', {
					instances: this.instances,
				})
			})

			socket.on('close', () => {
				this.elgatoDM.removeDevice(id)
				socket.removeAllListeners('keyup')
				socket.removeAllListeners('keydown')
			})
		})
	}

	handleBankChanged(page, bank) {
		page = parseInt(page)
		bank = parseInt(bank) - 1

		if (this.socket !== undefined && this.socket.button_listeners !== undefined) {
			let listeners = this.socket.button_listeners
			if (listeners[page] !== undefined && listeners[page][bank] !== undefined) {
				let button = this.graphics.getBank(page, parseInt(bank) + 1)

				this.socket.apicommand('fillImage', { page: page, bank: bank, keyIndex: bank, data: button.buffer })
			}
		}
	}

	initAPI2(socket) {
		this.debug('init api v2')
		socket.once('new_device', (id) => {
			this.debug('add device: ' + socket.remoteAddress, id)

			// Use ip right now, since the pluginUUID is new on each boot and makes Companion
			// forget all settings for the device. (page and orientation)
			id = 'elgato_plugin-' + socket.remoteAddress

			this.elgatoDM.addDevice({ path: id }, 'streamdeck_plugin')

			// Give elgato_plugin reference to socket
			this.system.emit(id + '_plugin_startup', socket)

			socket.apireply('new_device', { result: true })

			socket.button_listeners = {
				dynamic: {},
				static: {},
			}

			this.socket = socket

			socket.on('close', () => {
				delete socket.button_listeners
				this.elgatoDM.removeDevice(id)
				socket.removeAllListeners('keyup')
				socket.removeAllListeners('keydown')
				delete this.socket
			})
		})

		socket.on('request_button', (args) => {
			this.debug('request_button: ', args)

			if (socket.button_listeners[args.page] === undefined) {
				socket.button_listeners[args.page] = {}
			}

			socket.button_listeners[args.page][args.bank] = 1
			socket.apireply('request_button', { result: 'ok' })

			this.handleBankChanged(args.page, parseInt(args.bank) + 1)
		})

		socket.on('unrequest_button', (args) => {
			this.debug('unrequest_button: ', args)

			if (socket.button_listeners[args.page]) {
				delete socket.button_listeners[args.page][args.bank]
			}

			socket.apireply('request_button', { result: 'ok' })
		})
	}

	initSocket(socket) {
		socket.apireply = socketResponse.bind(socket)
		socket.apicommand = socketCommand.bind(socket)

		socket.on('version', (args) => {
			if (args.version > 2) {
				// Newer than current api version
				socket.apireply('version', { version: 2, error: 'cannot continue' })
				socket.close()
			} else if (args.version === 1) {
				// Support old clients
				socket.apireply('version', { version: 1 })

				this.initAPI1(socket)
			} else {
				socket.apireply('version', { version: 2 })

				this.initAPI2(socket)
			}
		})
	}
}

module.exports = ServiceElgatoPlugin
