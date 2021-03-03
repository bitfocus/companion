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

function server_tcp(system) {
	var self = this

	self.ready = true
	self.system = system
	self.clients = []

	self.server = net.createServer(function (socket) {
		socket.on('end', function () {
			self.clients.splice(self.clients.indexOf(socket), 1)
			debug('Client disconnected: ' + socket.name)
			system.emit('log', 'TCP Server', 'debug', 'Client disconnected: ' + socket.name)
		})

		socket.on('error', function () {
			self.clients.splice(self.clients.indexOf(socket), 1)
			debug('Client debug disconnected: ' + socket.name)
			system.emit('log', 'TCP Server', 'error', 'Client errored/died: ' + socket.name)
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
				system.emit('server_api_command', line.toString().replace(/\r/, ''), function (err, res) {
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

	self.server.on('error', function (e) {
		debug('TCP Server got error: ' + e)
	})

	try {
		debug('Trying: listen to tcp 51234')
		self.server.listen(51234)
		system.emit('log', 'TCP Server', 'info', 'Listening for TCP commands on port 51234')
	} catch (e) {
		system.emit('log', 'TCP Server', 'error', "Couldn't bind to TCP port 51234")
	}

	return self
}

exports = module.exports = function (system) {
	return new server_tcp(system)
}
