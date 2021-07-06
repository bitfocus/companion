/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
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

var debug = require('debug')('lib/server_tcp')
var net = require('net')

function decimalToRgb(decimal) {
	return {
		red: (decimal >> 16) & 0xff,
		green: (decimal >> 8) & 0xff,
		blue: decimal & 0xff,
	}
}
function server_tcp(system) {
	var self = this

	self.system = system
	self.clients = []

	let user_config = {}
	system.emit('db_get', 'userconfig', function (config) {
		user_config = config || {}
	})

	self.server_port = user_config.tcp_listen_port

	if (user_config.tcp_enabled) {
		self.start_listening()
	}

	system.on('set_userconfig_key', function (key, value) {
		if (key == 'tcp_enabled') {
			// start/stop listener
			if (value && !self.server) {
				self.start_listening()
			} else if (!value && self.server) {
				self.stop_listening()
			}
		} else if (key == 'tcp_listen_port') {
			self.server_port = value
			if (self.server) {
				// restart listener if already running
				self.start_listening()
			}
		}
	})

	system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
		if (self.clients) {
			let color = decimalToRgb(bgcolor)
			let response = {}
			response.type = 'bank_bg_change'
			response.page = page
			response.bank = bank
			response.red = color.red
			response.green = color.green
			response.blue = color.blue
			debug(`bank_bg send to all open sockets ${JSON.stringify(response)}`)
			self.clients.forEach((socket) => {
				socket.write(JSON.stringify(response) + '\n')
			})
		}
	})

	return self
}

server_tcp.prototype.start_listening = function () {
	var self = this

	if (self.server) {
		// cleanup an old server first
		self.stop_listening()
	}

	const port = self.server_port
	if (!port && typeof port !== 'number') {
		debug(`TCP Server disabled. Bad port ${port}`)
		return
	}

	self.server = net.createServer(function (socket) {
		socket.on('end', function () {
			self.clients.splice(self.clients.indexOf(socket), 1)
			debug('Client disconnected: ' + socket.name)
			self.system.emit('log', 'TCP Server', 'debug', 'Client disconnected: ' + socket.name)
		})

		socket.on('error', function () {
			self.clients.splice(self.clients.indexOf(socket), 1)
			debug('Client debug disconnected: ' + socket.name)
			self.system.emit('log', 'TCP Server', 'error', 'Client errored/died: ' + socket.name)
		})

		socket.name = socket.remoteAddress + ':' + socket.remotePort
		self.clients.push(socket)
		debug('Client connected: ' + socket.name)

		system.emit('log', 'TCP Server', 'debug', 'Client connected: ' + socket.name)

		// separate buffered stream into lines with responses
		var receivebuffer = ''

		socket.on('data', function (chunk) {
			var i = 0,
				line = '',
				offset = 0
			receivebuffer += chunk
			while ((i = receivebuffer.indexOf('\n', offset)) !== -1) {
				line = receivebuffer.substr(offset, i - offset)
				offset = i + 1
				self.system.emit('server_api_command', line.toString().replace(/\r/, ''), function (err, res) {
					if (err == null) {
						debug('TCP command succeeded')
					} else {
						debug('TCP command failed')
					}
					socket.write(res + '\n')
				})
			}
			receivebuffer = receivebuffer.substr(offset)
		})
	})

	self.server.on('listening', function () {
		debug('TCP Server ready')
		self.system.emit('log', 'TCP Server', 'info', 'Ready for commands')
	})

	self.server.on('error', function (e) {
		debug('TCP Server got error: ' + e)
		self.system.emit('log', 'TCP Server', 'error', 'Server failed: ' + e)
	})

	try {
		debug(`Trying: listen to tcp ${port}`)
		self.server.listen(port)
		self.system.emit('log', 'TCP Server', 'info', `Listening for TCP commands on port ${port}`)
	} catch (e) {
		self.system.emit('log', 'TCP Server', 'error', `Couldn't bind to TCP port ${port}`)
	}
}

server_tcp.prototype.stop_listening = function () {
	var self = this

	debug(`Stopping tcp server`)
	self.system.emit('log', 'TCP Server', 'info', `Stopping listening for TCP commands`)

	self.server.close()
	delete self.server
	self.clients = []
}

exports = module.exports = function (system) {
	return new server_tcp(system)
}
