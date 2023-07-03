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

import { Server as _io } from 'socket.io'
import LogController from '../Log/Controller.js'

class UIHandler {
	logger = LogController.createLogger('UI/Handler')

	constructor(registry, http) {
		this.registry = registry

		this.options = {
			allowEIO3: true,
			maxHttpBufferSize: 100 * 1000 * 1000, // bytes. 100mb matches socket.io v2. while not entirely safe, its what it used to be so is good enough for now
			cors: {
				// Allow everything
				origin: (o, cb) => cb(null, o),
				credentials: true,
			},
		}

		this.httpIO = new _io(http, this.options)

		this.httpIO.on('connect', this.clientConnect.bind(this))
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.logger.debug('socket ' + client.id + ' connected')

		// Wrap all 'client.on' calls, so that we 'handle' any errors they might throw
		const originalOn = client.on.bind(client)
		client.on = (name, fcn) => {
			return originalOn.call(client, name, (...args) => {
				try {
					fcn(...args)
				} catch (e) {
					this.logger.warn(`Error in client handler '${name}': ${e} ${e?.stack}`)
				}
			})
		}
		// Provide a promise based 'client.on' method, for methods which want to be promise based.
		// Note: it expects the last parameter to be the callback
		client.onPromise = (name, fcn) => {
			return originalOn.call(client, name, (...args) => {
				Promise.resolve().then(async () => {
					const cb = args.pop()
					try {
						const result = await fcn(...args)
						cb(null, result)
					} catch (e) {
						this.logger.warn(`Error in client handler '${name}': ${e} ${e?.stack}`)
						if (cb) cb(e?.message ?? 'error', null)
					}
				})
			})
		}

		client.onPromise('app-version-info', () => {
			return {
				appVersion: this.registry.appVersion,
				appBuild: this.registry.appBuild,
			}
		})

		this.registry.log.clientConnect(client)
		this.registry.ui.clientConnect(client)
		this.registry.data.clientConnect(client)
		this.registry.page.clientConnect(client)
		this.registry.controls.clientConnect(client)
		this.registry.preview.clientConnect(client)
		this.registry.surfaces.clientConnect(client)
		this.registry.instance.clientConnect(client)
		this.registry.cloud.clientConnect(client)

		client.on('disconnect', () => {
			this.logger.debug('socket ' + client.id + ' disconnected')
		})
	}

	emit(...args) {
		this.httpIO.emit(...args)

		if (this.httpsIO !== undefined) {
			this.httpsIO.emit(...args)
		}
	}

	emitToRoom(room, ...args) {
		this.httpIO.to(room).emit(...args)

		if (this.httpsIO !== undefined) {
			this.httpsIO.to(room).emit(...args)
		}
	}

	countRoomMembers(room) {
		let clientsInRoom = 0

		if (this.httpIO.sockets.adapter.rooms.has(room)) {
			clientsInRoom += this.httpIO.sockets.adapter.rooms.get(room).size
		}
		if (this.httpsIO && this.httpsIO.sockets.adapter.rooms.has(room)) {
			clientsInRoom += this.httpsIO.sockets.adapter.rooms.get(room).size
		}

		return clientsInRoom
	}

	enableHttps(https) {
		if (https !== undefined) {
			this.httpsIO = new _io(https, this.options)

			this.httpsIO.on('connect', this.clientConnect.bind(this))
		}
	}
}

export default UIHandler
