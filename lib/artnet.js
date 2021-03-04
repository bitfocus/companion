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

var debug = require('debug')('lib/artnet')
var dgram = require('dgram')
var system

function artnet(_system) {
	var self = this
	system = _system

	self.config = {}
	self.current_state = false

	self.current_page = 0
	self.current_bank = 0
	self.current_dir = 0

	system.emit('get_userconfig', function (obj) {
		self.config = obj

		if (self.config['artnet_enabled'] === undefined) {
			self.config['artnet_enabled'] = false
			system.emit('set_userconfig_key', 'artnet_enabled', self.config['artnet_enabled'])
		}

		if (self.config['artnet_universe'] === undefined || self.config['artnet_universe'] == '') {
			self.config['artnet_universe'] = '1'
			system.emit('set_userconfig_key', 'artnet_universe', self.config['artnet_universe'])
		}

		if (self.config['artnet_channel'] === undefined || self.config['artnet_channel'] == '') {
			self.config['artnet_channel'] = '1'
			system.emit('set_userconfig_key', 'artnet_channel', self.config['artnet_channel'])
		}

		if (self.config['artnet_enabled'] === true) {
			try {
				self.current_state = true
				self.listen(6454)
				system.emit('log', 'artnet', 'debug', 'Listening')
			} catch (e) {
				console.log('Error listening for artnet', e)
			}
		}
	})

	system.on('set_userconfig_key', function (key, val) {
		if (key == 'artnet_enabled') {
			if (self.current_state == false && val == true) {
				try {
					self.current_state = true
					self.listen(6454)
					system.emit('log', 'artnet', 'debug', 'Listening')
				} catch (e) {
					console.log('Error listening for artnet', e)
				}
			} else if (self.current_state == true && val == false) {
				self.current_state = false
				system.emit('log', 'artnet', 'debug', 'Destroying artnet socket')
				if (self.sock) {
					try {
						self.sock.close()
					} catch (e) {}
				}
			}
		}
	})
}

artnet.prototype.process_incoming = function (packet) {
	var self = this

	if (self.config['artnet_enabled'] == true) {
		// self.config['artnet_channel']
		// self.config['artnet_universe']
		if (parseInt(packet.universe) === parseInt(self.config['artnet_universe'])) {
			var ch = parseInt(self.config['artnet_channel'])
			if (ch >= 1) ch -= 1

			var dmx_page = parseInt(packet.data[ch])
			var dmx_bank = parseInt(packet.data[ch + 1])
			var dmx_dir = parseInt(packet.data[ch + 2])

			if (dmx_page !== self.current_page || dmx_bank !== self.current_bank || dmx_dir !== self.current_dir) {
				self.current_page = dmx_page
				self.current_bank = dmx_bank
				self.current_dir = dmx_dir

				if (dmx_dir == 0 || dmx_page == 0 || dmx_bank == 0) {
					return
				}

				// down
				if (dmx_dir > 128) {
					system.emit('bank_pressed', dmx_page, dmx_bank, false)
				}

				// up
				else if (dmx_dir >= 10) {
					system.emit('bank_pressed', dmx_page, dmx_bank, true)
				}

				// nothing.
				else {
				}
			}
		}
	}
}

artnet.prototype.listen = function (port) {
	var self = this

	self.sock = dgram.createSocket('udp4', function (msg, peer) {
		var sequence = msg.readUInt8(12, true)
		var physical = msg.readUInt8(13, true)
		var universe = msg.readUInt8(14, true)
		var offset = msg.readUInt8(16, true)
		var length = msg.readUInt8(17, true)

		var rawData = []

		for (i = 18; i < 18 + 255; i++) {
			rawData.push(msg.readUInt8(i, true))
		}

		var retData = {
			sequence: sequence,
			physical: physical,
			universe: universe,
			length: length,
			data: rawData,
		}

		self.process_incoming(retData)
	})

	self.sock.on('error', function (err) {
		debug('server error:', err.stack)
		self.sock.close()
	})

	self.sock.bind(port)
}

module.exports = function (system) {
	return new artnet(system)
}
