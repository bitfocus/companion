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

const ServiceBase = require('./Base')
const net = require('net')

class ServiceTcpBase extends ServiceBase {
	constructor(registry, logSource, defaults, defaultItem) {
		super(registry, logSource, defaults, defaultItem)

		this.clients = []
	}

	listen() {
		if (this.receiveBuffer === undefined) {
			this.receiveBuffer = ''
		}

		if (this.socket === undefined) {
			try {
				this.socket = net.createServer((client) => {
					client.on('end', () => {
						this.clients.splice(this.clients.indexOf(client), 1)
						this.debug('Client disconnected: ' + client.name)
						this.log('debug', 'Client disconnected: ' + client.name)
					})

					client.on('error', () => {
						this.clients.splice(this.clients.indexOf(client), 1)
						this.debug('Client debug disconnected: ' + client.name)
						this.log('error', 'Client errored/died: ' + client.name)
					})

					client.name = client.remoteAddress + ':' + client.remotePort
					this.clients.push(client)
					this.debug('Client connected: ' + client.name)

					this.log('debug', 'Client connected: ' + client.name)

					client.on('data', this.processIncoming.bind(this, client))

					if (this.initClient !== undefined && typeof this.initClient == 'function') {
						this.initClient(client)
					}
				})

				this.socket.on('error', this.handleSocketError.bind(this))

				this.socket.listen(this.port)
				this.currentState = true
				this.log('debug', 'Listening on port ' + this.port)
				this.debug('Listening on port ' + this.port)
			} catch (e) {
				this.log('error', `${this.logSource} could not launch`)
			}
		}
	}
}

exports = module.exports = ServiceTcpBase
