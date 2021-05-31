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

const CoreBase = require('../Core/Base')
const WebSocketServer = require('websocket').server
const http = require('http')

const socketResponse = function (command, args) {
	this.sendUTF(JSON.stringify({ response: command, arguments: args }))
}

const socketCommand = function (command, args) {
	this.sendUTF(JSON.stringify({ command: command, arguments: args }))
}

class ServiceWebSockets extends CoreBase {
	debug = require('debug')('Service/WebSockets')
	constructor(registry) {
		super(registry, 'ws-api')

		this.instance = this.db.getKey('instance')

		this.system.on('graphics_bank_invalidated', (page, button) => {
			this.handleBankChanged(page, button)
		})

		this.http = http.createServer((request, response) => {
			response.writeHead(404)
			response.end('Not found')
		})

		this.http.on('error', (err) => {
			this.debug('ERROR opening port 28492 for ws-api', err)
		})

		this.http.listen(28492, () => {
			this.debug('ws-api ready')
		})

		this.ws = new WebSocketServer({
			httpServer: this.http,
			autoAcceptConnections: false,
		})

		this.ws.on('request', this.request.bind(this))
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

	initAPIv1(socket) {
		this.debug('init api')

		socket.once('new_device', (id) => {
			this.debug('add device: ' + socket.remoteAddress, id)

			// Use ip right now, since the pluginUUID is new on each boot and makes Companion
			// forget all settings for the device. (page and orientation)
			id = 'elgato_plugin-' + socket.remoteAddress

			this.devices.addDevice({ path: id }, 'DeviceSoftwareStreamdeckPlugin')

			// Give elgato_plugin reference to socket
			this.system.emit(id + '_plugin_startup', socket)

			socket.apireply('new_device', { result: true })

			socket.on('get_instances', (args) => {
				socket.apireply('get_instances', {
					instances: this.instance,
				})
			})

			socket.on('get_image')

			socket.on('close', () => {
				this.devices.removeDevice(id)
				socket.removeAllListeners('keyup')
				socket.removeAllListeners('keydown')
			})
		})
	}

	initAPIv2(socket) {
		this.debug('init api v2')

		socket.once('new_device', (id) => {
			this.debug('add device: ' + socket.remoteAddress, id)

			// Use ip right now, since the pluginUUID is new on each boot and makes Companion
			// forget all settings for the device. (page and orientation)
			id = 'elgato_plugin-' + socket.remoteAddress

			this.devices.addDevice({ path: id }, 'DeviceSoftwareStreamdeckPlugin')

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
				this.devices.removeDevice(id)
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

				this.initAPIv1(socket)
			} else {
				socket.apireply('version', { version: 2 })

				this.initAPIv2(socket)
			}
		})
	}

	request(req) {
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
	}
}

exports = module.exports = ServiceWebSockets
