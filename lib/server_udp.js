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

var debug = require('debug')('lib/server_udp')
var dgram = require('dgram')

function server_udp(system) {
	var self = this

	self.system = system

	let user_config = {}
	system.emit('db_get', 'userconfig', function (config) {
		user_config = config || {}
	})

	self.server_port = user_config.udp_listen_port

	if (user_config.udp_enabled) {
		self.start_listening()
	}

	system.on('set_userconfig_key', function (key, value) {
		if (key == 'udp_enabled') {
			// start/stop listener
			if (value && !self.server) {
				self.start_listening()
			} else if (!value && self.server) {
				self.stop_listening()
			}
		} else if (key == 'udp_listen_port') {
			self.server_port = value
			if (self.server) {
				// restart listener if already running
				self.start_listening()
			}
		}
	})

	return self
}

server_udp.prototype.start_listening = function () {
	var self = this

	if (self.server) {
		// cleanup an old server first
		self.stop_listening()
	}

	const port = self.server_port
	if (!port && typeof port !== 'number') {
		debug(`UDP Server disabled. Bad port ${port}`)
		return
	}

	self.server = dgram.createSocket('udp4')
	self.server.on('listening', function () {
		var address = self.server.address()
		debug(`UDP Server listening on ${address.address}:${address.port}`)
	})

	self.server.on('message', function (data, remote) {
		debug(`${remote.address}:${remote.port} received packet: "${data.toString().trim()}"`)
		self.system.emit('server_api_command', data.toString(), function (err, res) {
			if (err == null) {
				debug('UDP command succeeded')
			} else {
				debug('UDP command failed')
			}
		})
	})

	self.server.on('error', function (e) {
		debug('UDP Server got error: ' + e)
		self.system.emit('log', 'UDP Server', 'error', 'Server failed: ' + e)
	})

	try {
		debug(`Trying: listen to udp ${port}`)
		self.system.emit('log', 'UDP Server', 'info', `Listening for UDP commands on port ${port}`)
		self.server.bind(port, '0.0.0.0')
	} catch (e) {
		self.system.emit('log', 'UDP Server', 'error', `Couldn't bind to UDP port ${port}`)
		delete self.server
	}
}

server_udp.prototype.stop_listening = function () {
	var self = this

	debug(`Stopping udp server`)
	self.system.emit('log', 'UDP Server', 'info', `Stopping listening for UDP commands`)

	self.server.close()
	delete self.server
}

exports = module.exports = function (system) {
	return new server_udp(system)
}
