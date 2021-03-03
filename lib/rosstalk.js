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
	constructor(system) {
		this.system = system

		this.config = {}
		this.currentState = false
		this.port = 7788

		this.releaseTime = 20 // ms to send button release

		this.system.emit('get_userconfig', (obj) => {
			this.config = obj

			this.setDefaults()

			if (this.config['rosstalk_enabled'] === true) {
				this.enableModule()
			}
		})

		this.system.on('set_userconfig_key', (key, val) => {
			if (key == 'rosstalk_enabled') {
				if (this.currentState == false && val == true) {
					this.enableModule()
				} else if (this.currentState == true && val == false) {
					this.disableModule()
				}
			}
		})
	}

	disableModule() {
		this.currentState = false
		this.system.emit('log', 'rosstalk', 'debug', 'Stopped listening on port ' + this.port)

		if (this.socket) {
			try {
				this.socket.close()
			} catch (e) {}
		}
	}

	enableModule() {
		try {
			this.listen()
			this.currentState = true
			this.system.emit('log', 'rosstalk', 'debug', 'Listening on port ' + this.port)
		} catch (e) {
			console.log('Error listening for rosstalk', e)
		}
	}

	handleSocketError(e) {
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
		this.disableModule()
	}

	listen() {
		if (this.socket === undefined) {
			this.socket = net.createServer((client) => {
				client.on('data', (data) => {
					data = data.toString('utf8')
					this.processIncomming(data)
				})
				client.on('error', this.handleSocketError.bind(this))
			})

			this.socket.listen(this.port)
		}
	}

	pressButton(page, bank) {
		page = parseInt(page)
		bank = parseInt(bank)

		this.system.emit('log', 'rosstalk', 'debug', `Push button ${page}.${bank}`)
		this.system.emit('bank_pressed', page, bank, true)

		setTimeout(() => {
			this.system.emit('bank_pressed', page, bank, false)
			this.system.emit('log', 'rosstalk', 'debug', `Release button ${page}.${bank}`)
		}, this.releaseTime)
	}

	processIncomming(data) {
		// Type, bank/page, CC/bnt number
		const match = data.match(/(CC) ([0-9]*)\:([0-9]*)/)
		if (match === null) {
			this.system.emit('log', 'rosstalk', 'warn', `Invalid incomming RossTalk command: ${data}`)
			return
		}

		if (match[1] === 'CC') {
			this.pressButton(match[2], match[3])
		}
	}

	setDefaults() {
		if (this.config['rosstalk_enabled'] === undefined) {
			this.config['rosstalk_enabled'] = false
			this.system.emit('set_userconfig_key', 'rosstalk_enabled', this.config['rosstalk_enabled'])
		}
	}
}

module.exports = function (system) {
	return new rosstalk(system)
}
