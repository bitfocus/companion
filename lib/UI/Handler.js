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

import { Server as _io, Socket } from 'socket.io'
import LogController from '../Log/Controller.js'

export class ClientSocket {
	/**
	 * Logger
	 * @type {import('winston').Logger}
	 */
	logger

	/**
	 * Socket.io socket
	 * @type {Socket}
	 * @access private
	 */
	#socket

	/**
	 * @param {Socket} socket
	 * @param {import('winston').Logger} logger
	 */
	constructor(socket, logger) {
		this.#socket = socket
		this.logger = logger
	}

	get id() {
		return this.#socket.id
	}

	/**
	 * Join a room
	 * @param {string} room
	 * @returns {void}
	 */
	join(room) {
		this.#socket.join(room)
	}
	/**
	 * Leave a room
	 * @param {string} room
	 * @returns {void}
	 */
	leave(room) {
		this.#socket.leave(room)
	}

	/**
	 * Send a message to the client
	 * @param {string} name
	 * @param  {...any[]} args
	 */
	emit(name, ...args) {
		this.#socket.emit(name, ...args)
	}

	/**
	 * Listen to an event
	 * @param {string} name
	 * @param {function} fcn
	 * @returns {ClientSocket}
	 */
	on(name, fcn) {
		this.#socket.on(name, (...args) => {
			try {
				fcn(...args)
			} catch (e) {
				this.logger.warn(`Error in client handler '${name}': ${e} ${e?.stack}`)
			}
		})
		return this
	}
	/**
	 * A promise based alternative to the `on` method, for methods which want to return a value.
	 * Note: it expects the last parameter of the call to be the callback
	 * @param {string} name
	 * @param {function} fcn
	 * @returns {ClientSocket}
	 */
	onPromise(name, fcn) {
		this.#socket.on(name, (...args) => {
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
		return this
	}
}

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
	 * @param {Socket} client - the client socket
	 * @access public
	 */
	clientConnect(rawClient) {
		this.logger.debug(`socket ${rawClient.id} connected`)

		const client = new ClientSocket(rawClient, this.logger)

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
		this.registry.services.clientConnect(client)

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
