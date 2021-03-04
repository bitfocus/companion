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
var server = dgram.createSocket('udp4')

function server_udp(system) {
	var self = this

	self.system = system

	server.on('listening', function () {
		var address = server.address()
		debug('UDP Server listening on ' + address.address + ':' + address.port)
	})

	server.on('message', function (data, remote) {
		debug(remote.address + ':' + remote.port + ' received packet: ' + data.toString().trim())
		system.emit('server_api_command', data.toString(), function (err, res) {
			if (err == null) {
				debug('UDP command succeeded')
			} else {
				debug('UDP command failed')
			}
		})
	})

	try {
		debug('Trying: listen to udp 51235')
		system.emit('log', 'UDP Server', 'info', 'Listening for UDP commands on port 51235')
		server.bind(51235, '0.0.0.0')
	} catch (e) {
		system.emit('log', 'UDP Server', 'error', "Couldn't bind to UDP port 51235")
	}
}

exports = module.exports = function (system) {
	return new server_udp(system)
}
