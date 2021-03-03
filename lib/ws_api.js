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

var system
var debug = require('debug')('lib/ws_api')
var WebSocketServer = require('websocket').server
var http = require('http')
var graphics
var elgatoDM

function wsapi(_system) {
	var self = this
	system = _system

	elgatoDM = require('./elgato_dm')(system)

	graphics = new require('./graphics')(system)

	system.emit('db_get', 'instance', function (res) {
		self.instance = res
	})

	system.on('graphics_bank_invalidated', function (page, button) {
		self.handleBankChanged(page, button)
	})

	self.http = http.createServer(function (request, response) {
		response.writeHead(404)
		response.end('Not found')
	})
	self.http.on('error', function (err) {
		debug('ERROR opening port 28492 for ws-api', err)
	})
	self.http.listen(28492, function () {
		debug('ws-api ready')
	})

	self.ws = new WebSocketServer({
		httpServer: self.http,
		autoAcceptConnections: false,
	})

	self.ws.on('request', function (req) {
		var socket = req.accept('', req.origin)
		debug('New connection from ' + socket.remoteAddress)

		self.initSocket(socket)

		socket.on('message', function (message) {
			if (message.type == 'utf8') {
				try {
					var data = JSON.parse(message.utf8Data)
					socket.emit(data.command, data.arguments)
					//debug('emitting command ' + data.command);
				} catch (e) {
					debug('protocol error:', e)
				}
			}
		})

		socket.on('close', function () {
			debug('Connection from ' + socket.remoteAddress + ' disconnected')
		})
	})
}

function socketResponse(command, args) {
	this.sendUTF(JSON.stringify({ response: command, arguments: args }))
}
function socketCommand(command, args) {
	this.sendUTF(JSON.stringify({ command: command, arguments: args }))
}

wsapi.prototype.initAPI1 = function (socket) {
	var self = this

	debug('init api')
	socket.once('new_device', function (id) {
		debug('add device: ' + socket.remoteAddress, id)

		// Use ip right now, since the pluginUUID is new on each boot and makes Companion
		// forget all settings for the device. (page and orientation)
		id = 'elgato_plugin-' + socket.remoteAddress

		elgatoDM.addDevice({ path: id }, 'streamdeck_plugin')

		// Give elgato_plugin reference to socket
		system.emit(id + '_plugin_startup', socket)

		socket.apireply('new_device', { result: true })

		socket.on('get_instances', function (args) {
			socket.apireply('get_instances', {
				instances: self.instance,
			})
		})

		socket.on('get_image', function (args) {
			debug('Generate button from: ', args.config)

			var img = graphics.drawBankImage(args.config, undefined, undefined, true)
			if (img !== undefined) {
				socket.apireply('get_image', { buffer: img.buffer() })
			} else {
				socket.apireply('get_image', { error: 'Bug' })
			}
		})

		socket.on('close', function () {
			elgatoDM.removeDevice(id)
			socket.removeAllListeners('keyup')
			socket.removeAllListeners('keydown')
		})
	})
}

wsapi.prototype.handleBankChanged = function (page, bank) {
	var self = this

	page = parseInt(page)
	bank = parseInt(bank) - 1

	if (self.socket !== undefined && self.socket.button_listeners !== undefined) {
		var listeners = self.socket.button_listeners
		if (listeners[page] !== undefined && listeners[page][bank] !== undefined) {
			var button = graphics.getBank(page, parseInt(bank) + 1)

			self.socket.apicommand('fillImage', { page: page, bank: bank, keyIndex: bank, data: button.buffer })
		}
	}
}

wsapi.prototype.initAPI2 = function (socket) {
	var self = this

	debug('init api v2')
	socket.once('new_device', function (id) {
		debug('add device: ' + socket.remoteAddress, id)

		// Use ip right now, since the pluginUUID is new on each boot and makes Companion
		// forget all settings for the device. (page and orientation)
		id = 'elgato_plugin-' + socket.remoteAddress

		elgatoDM.addDevice({ path: id }, 'streamdeck_plugin')

		// Give elgato_plugin reference to socket
		system.emit(id + '_plugin_startup', socket)

		socket.apireply('new_device', { result: true })

		socket.button_listeners = {
			dynamic: {},
			static: {},
		}

		self.socket = socket

		socket.on('close', function () {
			delete socket.button_listeners
			elgatoDM.removeDevice(id)
			socket.removeAllListeners('keyup')
			socket.removeAllListeners('keydown')
			delete self.socket
		})
	})

	socket.on('request_button', function (args) {
		debug('request_button: ', args)

		if (socket.button_listeners[args.page] === undefined) {
			socket.button_listeners[args.page] = {}
		}

		socket.button_listeners[args.page][args.bank] = 1
		socket.apireply('request_button', { result: 'ok' })

		self.handleBankChanged(args.page, parseInt(args.bank) + 1)
	})

	socket.on('unrequest_button', function (args) {
		debug('unrequest_button: ', args)

		if (socket.button_listeners[args.page]) {
			delete socket.button_listeners[args.page][args.bank]
		}

		socket.apireply('request_button', { result: 'ok' })
	})
}

wsapi.prototype.initSocket = function (socket) {
	var self = this

	socket.apireply = socketResponse.bind(socket)
	socket.apicommand = socketCommand.bind(socket)

	socket.on('version', function (args) {
		if (args.version > 2) {
			// Newer than current api version
			socket.apireply('version', { version: 2, error: 'cannot continue' })
			socket.close()
		} else if (args.version === 1) {
			// Support old clients
			socket.apireply('version', { version: 1 })

			self.initAPI1(socket)
		} else {
			socket.apireply('version', { version: 2 })

			self.initAPI2(socket)
		}
	})
}

exports = module.exports = function (system) {
	return new wsapi(system)
}
