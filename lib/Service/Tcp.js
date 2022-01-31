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
const { decimalToRgb } = require('../Resources/Util')
const CoreBase = require('../Core/Base')

class ServiceTcp extends CoreBase {
	constructor(registry) {
		super(registry, 'tcp', 'lib/Service/Tcp')
		this.clients = []

		let user_config = {}
		this.system.emit('db_get', 'userconfig', (config) => {
			user_config = config || {}
		})

		this.server_port = user_config.tcp_listen_port

		if (user_config.tcp_enabled) {
			this.start_listening()
		}

		this.system.on('set_userconfig_key', (key, value) => {
			if (key == 'tcp_enabled') {
				// start/stop listener
				if (value && !this.server) {
					this.start_listening()
				} else if (!value && this.server) {
					this.stop_listening()
				}
			} else if (key == 'tcp_listen_port') {
				this.server_port = value
				if (this.server) {
					// restart listener if already running
					this.start_listening()
				}
			}
		})

		this.system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
			if (this.clients) {
				let color = decimalToRgb(bgcolor)
				let response = {}
				response.type = 'bank_bg_change'
				response.page = page
				response.bank = bank
				response.red = color.red
				response.green = color.green
				response.blue = color.blue
				this.debug(`bank_bg send to all open sockets ${JSON.stringify(response)}`)
				this.clients.forEach((socket) => {
					socket.write(JSON.stringify(response) + '\n')
				})
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
			this.debug(`TCP Server disabled. Bad port ${port}`)
			return
		}

		this.server = net.createServer((socket) => {
			socket.on('end', () => {
				this.clients.splice(this.clients.indexOf(socket), 1)
				this.debug('Client disconnected: ' + socket.name)
				this.system.emit('log', 'TCP Server', 'debug', 'Client disconnected: ' + socket.name)
			})

			socket.on('error', () => {
				this.clients.splice(this.clients.indexOf(socket), 1)
				this.debug('Client debug disconnected: ' + socket.name)
				this.system.emit('log', 'TCP Server', 'error', 'Client errored/died: ' + socket.name)
			})

			socket.name = socket.remoteAddress + ':' + socket.remotePort
			this.clients.push(socket)
			this.debug('Client connected: ' + socket.name)

			this.system.emit('log', 'TCP Server', 'debug', 'Client connected: ' + socket.name)

			// separate buffered stream into lines with responses
			this.receiveBuffer = ''

			socket.on('data', (chunk) => {
				let i = 0,
					line = '',
					offset = 0
				this.receiveBuffer += chunk
				while ((i = this.receiveBuffer.indexOf('\n', offset)) !== -1) {
					line = this.receiveBuffer.substr(offset, i - offset)
					offset = i + 1
					this.system.emit('server_api_command', line.toString().replace(/\r/, ''), (err, res) => {
						if (err == null) {
							this.debug('TCP command succeeded')
						} else {
							this.debug('TCP command failed')
						}
						socket.write(res + '\n')
					})
				}
				this.receiveBuffer = this.receiveBuffer.substr(offset)
			})
		})

		this.server.on('listening', () => {
			this.debug('TCP Server ready')
			this.system.emit('log', 'TCP Server', 'info', 'Ready for commands')
		})

		this.server.on('error', (e) => {
			this.debug('TCP Server got error: ' + e)
			this.system.emit('log', 'TCP Server', 'error', 'Server failed: ' + e)
		})

		try {
			this.debug(`Trying: listen to tcp ${port}`)
			this.server.listen(port)
			this.system.emit('log', 'TCP Server', 'info', `Listening for TCP commands on port ${port}`)
		} catch (e) {
			this.system.emit('log', 'TCP Server', 'error', `Couldn't bind to TCP port ${port}`)
		}
	}

	stop_listening() {
		this.debug(`Stopping tcp server`)
		this.system.emit('log', 'TCP Server', 'info', `Stopping listening for TCP commands`)

		this.server.close()
		delete this.server
		this.clients = []
	}
}

module.exports = ServiceTcp
