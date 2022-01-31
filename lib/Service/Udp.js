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
const CoreBase = require('../Core/Base')

class ServiceUdp extends CoreBase {
	constructor(registry) {
		super(registry, 'udp', 'lib/Service/Udp')

		let user_config = this.db.getKey('userconfig', {})

		this.server_port = user_config.udp_listen_port

		if (user_config.udp_enabled) {
			this.start_listening()
		}

		this.system.on('set_userconfig_key', (key, value) => {
			if (key == 'udp_enabled') {
				// start/stop listener
				if (value && !this.server) {
					this.start_listening()
				} else if (!value && this.server) {
					this.stop_listening()
				}
			} else if (key == 'udp_listen_port') {
				this.server_port = value
				if (this.server) {
					// restart listener if already running
					this.start_listening()
				}
			}
		})
	}

	start_listening() {
		if (this.server) {
			// cleanup an old server first
			this.stop_listening()
		}

		const port = this.server_port
		if (!port && typeof port !== 'number') {
			this.debug(`UDP Server disabled. Bad port ${port}`)
			return
		}

		this.server = dgram.createSocket('udp4')
		this.server.on('listening', () => {
			let address = this.server.address()
			this.debug(`UDP Server listening on ${address.address}:${address.port}`)
		})

		this.server.on('message', (data, remote) => {
			this.debug(`${remote.address}:${remote.port} received packet: "${data.toString().trim()}"`)
			this.system.emit('server_api_command', data.toString(), (err, res) => {
				if (err == null) {
					this.debug('UDP command succeeded')
				} else {
					this.debug('UDP command failed')
				}
			})
		})

		this.server.on('error', (e) => {
			this.debug('UDP Server got error: ' + e)
			this.system.emit('log', 'UDP Server', 'error', 'Server failed: ' + e)
		})

		try {
			this.debug(`Trying: listen to udp ${port}`)
			this.system.emit('log', 'UDP Server', 'info', `Listening for UDP commands on port ${port}`)
			this.server.bind(port, '0.0.0.0')
		} catch (e) {
			this.system.emit('log', 'UDP Server', 'error', `Couldn't bind to UDP port ${port}`)
			delete this.server
		}
	}

	stop_listening() {
		this.debug(`Stopping udp server`)
		this.system.emit('log', 'UDP Server', 'info', `Stopping listening for UDP commands`)

		this.server.close()
		delete this.server
	}
}

module.exports = ServiceUdp
