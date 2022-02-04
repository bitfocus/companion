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

const net = require('net')
const CoreBase = require('../Core/Base')

class ServiceRosstalk extends CoreBase {
	constructor(registry) {
		super(registry, 'rosstalk', 'lib/Service/Rosstalk')

		this.active = false
		this.socket = this.create_socket()
		this.port = 7788
		this.release_time = 20 // ms to send button release

		this.config = {}
		this.config.rosstalk_enabled = this.userconfig.getKey('rosstalk_enabled')

		if (this.config['rosstalk_enabled'] === true) {
			try {
				this.listen()
			} catch (e) {
				this.debug(`Error listening for rosstalk: ${e}`)
			}
		}
	}

	updateUserconfig(key, value) {
		if (key !== 'rosstalk_enabled') {
			return
		}

		this.config['rosstalk_enabled'] = value

		try {
			if (value === true) {
				this.listen()
			} else {
				this.close()
			}
		} catch (e) {
			this.debug(`Error listening/stopping rosstalk: ${e}`)
		}
	}

	handle_socket_error(e) {
		let message
		switch (e.code) {
			case 'EADDRINUSE':
				message = `Port ${this.port} already in use.`
				break
			case 'EACCES':
				message = `Access to port ${this.port} denied.`
				break
			default:
				message = `Could not open socket on port ${this.port}: ${e.code}`
		}

		this.log('error', message)
		this.close()
	}

	create_socket() {
		return net.createServer((socket) => {
			socket.on('data', (data) => {
				data = data.toString('utf8')
				this.process_incomming(data)
			})
			socket.on('error', this.handle_socket_error.bind(this))
		})
	}

	close() {
		if (this.active) {
			this.log('debug', 'Stopped listening on port ' + this.port)
			this.socket.close()
			this.active = false
		}
	}

	process_incomming(data) {
		// Type, bank/page, CC/bnt number
		const match = data.match(/(CC) ([0-9]*)\:([0-9]*)/)
		if (match === null) {
			this.log('warn', `Invalid incomming RossTalk command: ${data}`)
			return
		}

		if (match[1] === 'CC') {
			this.press_button(match[2], match[3])
		}
	}

	press_button(bank, button) {
		bank = parseInt(bank)
		button = parseInt(button)

		this.log('info', `Push button ${bank}.${button}`)
		this.system.emit('bank_pressed', bank, button, true)

		setTimeout(() => {
			this.system.emit('bank_pressed', bank, button, false)
			this.log('info', `Release button ${bank}.${button}`)
		}, this.release_time)
	}

	listen() {
		if (this.active) {
			return // already listening
		}

		this.log('debug', 'Listening on port ' + this.port)
		this.active = true

		this.socket.listen(this.port)
	}
}

module.exports = ServiceRosstalk
