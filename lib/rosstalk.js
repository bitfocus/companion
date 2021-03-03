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

let net = require('net')

class rosstalk {
	constructor(_system) {
		this.system = _system
		this.active = false
		this.socket = this.create_socket()
		this.port = 7788
		this.release_time = 20 // ms to send button release

		this.system.emit('get_userconfig', (obj) => {
			this.config = obj

			if (this.config['rosstalk_enabled'] === undefined) {
				this.config['rosstalk_enabled'] = false
				this.system.emit('set_userconfig_key', 'rosstalk_enabled', this.config['rosstalk_enabled'])
			}

			if (this.config['rosstalk_enabled'] === true) {
				try {
					this.listen()
				} catch (e) {
					console.log('Error listening for rosstalk', e)
				}
			}
		})

		this.system.on('set_userconfig_key', (key, val) => {
			if (key !== 'rosstalk_enabled') {
				return
			}

			this.config['rosstalk_enabled'] = val

			try {
				if (val === true) {
					this.listen()
				} else {
					this.close()
				}
			} catch (e) {
				console.log('Error listening/stopping rosstalk', e)
			}
		})
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

		this.system.emit('log', 'rosstalk', 'error', message)
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
			this.system.emit('log', 'rosstalk', 'debug', 'Stopped listening on port ' + this.port)
			this.socket.close()
			this.active = false
		}
	}

	process_incomming(data) {
		// Type, bank/page, CC/bnt number
		const match = data.match(/(CC) ([0-9]*)\:([0-9]*)/)
		if (match === null) {
			this.system.emit('log', 'rosstalk', 'warn', `Invalid incomming RossTalk command: ${data}`)
			return
		}

		if (match[1] === 'CC') {
			this.press_button(match[2], match[3])
		}
	}

	press_button(bank, button) {
		bank = parseInt(bank)
		button = parseInt(button)

		this.system.emit('log', 'rosstalk', 'info', `Push button ${bank}.${button}`)
		this.system.emit('bank_pressed', bank, button, true)

		setTimeout(() => {
			this.system.emit('bank_pressed', bank, button, false)
			this.system.emit('log', 'rosstalk', 'info', `Release button ${bank}.${button}`)
		}, this.release_time)
	}

	listen() {
		if (this.active) {
			return // already listening
		}

		this.system.emit('log', 'rosstalk', 'debug', 'Listening on port ' + this.port)
		this.active = true

		this.socket.listen(this.port)
	}
}

module.exports = function (system) {
	return new rosstalk(system)
}
