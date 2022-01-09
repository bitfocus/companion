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

const dgram = require('dgram')

class artnet {
	debug = require('debug')('lib/artnet')

	constructor(system) {
		this.system = system

		this.config = {}
		this.current_state = false

		this.current_page = 0
		this.current_bank = 0
		this.current_dir = 0

		this.system.emit('get_userconfig', (obj) => {
			this.config = obj

			if (this.config['artnet_enabled'] === true) {
				try {
					this.current_state = true
					this.listen(6454)
					this.system.emit('log', 'artnet', 'debug', 'Listening')
				} catch (e) {
					console.log('Error listening for artnet', e)
				}
			}
		})

		this.system.on('set_userconfig_key', (key, val) => {
			if (key == 'artnet_enabled') {
				if (this.current_state == false && val == true) {
					try {
						this.current_state = true
						this.listen(6454)
						this.system.emit('log', 'artnet', 'debug', 'Listening')
					} catch (e) {
						console.log('Error listening for artnet', e)
					}
				} else if (this.current_state == true && val == false) {
					this.current_state = false
					this.system.emit('log', 'artnet', 'debug', 'Destroying artnet socket')
					if (this.sock) {
						try {
							this.sock.close()
						} catch (e) {}
					}
				}
			}
		})
	}

	process_incoming(packet) {
		if (this.config['artnet_enabled'] == true) {
			if (parseInt(packet.universe) === parseInt(this.config['artnet_universe'])) {
				let ch = parseInt(this.config['artnet_channel'])
				if (ch >= 1) ch -= 1

				let dmx_page = parseInt(packet.data[ch])
				let dmx_bank = parseInt(packet.data[ch + 1])
				let dmx_dir = parseInt(packet.data[ch + 2])

				if (dmx_page !== this.current_page || dmx_bank !== this.current_bank || dmx_dir !== this.current_dir) {
					this.current_page = dmx_page
					this.current_bank = dmx_bank
					this.current_dir = dmx_dir

					if (dmx_dir == 0 || dmx_page == 0 || dmx_bank == 0) {
						return
					}

					// down
					if (dmx_dir > 128) {
						this.system.emit('bank_pressed', dmx_page, dmx_bank, false)
					}

					// up
					else if (dmx_dir >= 10) {
						this.system.emit('bank_pressed', dmx_page, dmx_bank, true)
					}

					// nothing.
					else {
					}
				}
			}
		}
	}

	listen(port) {
		this.sock = dgram.createSocket('udp4', (msg, peer) => {
			try {
				if (msg.length >= 18 + 255) {
					let sequence = msg.readUInt8(12, true)
					let physical = msg.readUInt8(13, true)
					let universe = msg.readUInt8(14, true)
					let offset = msg.readUInt8(16, true)
					let length = msg.readUInt8(17, true)

					let rawData = []

					for (i = 18; i < 18 + 255; i++) {
						rawData.push(msg.readUInt8(i, true))
					}

					let retData = {
						sequence: sequence,
						physical: physical,
						universe: universe,
						length: length,
						data: rawData,
					}

					this.process_incoming(retData)
				}
			} catch (e) {
				this.debug(`message error: ${err.toString()}`, err.stack)
			}
		})

		this.sock.on('error', (err) => {
			this.debug('server error:', err.stack)
			this.sock.close()
		})

		this.sock.bind(port)
	}
}

module.exports = function (system) {
	return new artnet(system)
}
