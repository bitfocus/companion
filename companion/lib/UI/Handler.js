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

import { Server as _io, Server, Socket } from 'socket.io'
import LogController from '../Log/Controller.js'

/**
 * @typedef {import('@companion-app/shared/SocketIO.js').ClientToBackendEventsListenMap} IOListenEvents
 * @typedef {import('@companion-app/shared/SocketIO.js').BackendToClientEventsMap} IOEmitEvents
 * @typedef {import('@companion-app/shared/SocketIO.js').ClientToBackendEventsWithNoResponse} IOListenEventsNoResponse
 * @typedef {import('@companion-app/shared/SocketIO.js').ClientToBackendEventsWithPromiseResponse} IOListenEventsWithResponse
 * @typedef {Server<IOListenEvents, IOEmitEvents>} IOServerType
 */

/**
 * Wrapper around a socket.io client socket, to provide a promise based api for async calls
 */
export class ClientSocket {
	/**
	 * Logger
	 * @type {import('winston').Logger}
	 */
	logger

	/**
	 * Socket.io socket
	 * @type {Socket<IOListenEvents, IOEmitEvents>}
	 * @access private
	 */
	#socket

	/**
	 * @param {Socket<IOListenEvents, IOEmitEvents>} socket
	 * @param {import('winston').Logger} logger
	 */
	constructor(socket, logger) {
		this.#socket = socket
		this.logger = logger
	}

	/**
	 * Unique id for the socket
	 * @returns {string}
	 */
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
	 * @template {keyof IOEmitEvents} T
	 * @param {T} name
	 * @param {Parameters<IOEmitEvents[T]>} args
	 * @returns {void}
	 */
	emit(name, ...args) {
		this.#socket.emit(name, ...args)
	}

	/**
	 * Listen to an event
	 * @template {keyof IOListenEventsNoResponse} T
	 * @param {T} name
	 * @param {IOListenEvents[T]} fcn
	 * @returns {ClientSocket}
	 */
	on(name, fcn) {
		// @ts-expect-error Types are hard to get correct
		this.#socket.on(name, (...args) => {
			try {
				// @ts-expect-error Typs are hard
				fcn(...args)
			} catch (/** @type {any} */ e) {
				this.logger.warn(`Error in client handler '${name}': ${e} ${e?.stack}`)
			}
		})
		return this
	}
	/**
	 * A promise based alternative to the `on` method, for methods which want to return a value.
	 * Note: it expects the first parameter of the call to be the callback
	 * @template {keyof IOListenEventsWithResponse} T
	 * @param {T} name
	 * @param {IOListenEvents[T]} fcn
	 * @returns {ClientSocket}
	 */
	onPromise(name, fcn) {
		// @ts-expect-error Types are hard
		this.#socket.on(name, (args, cb) => {
			Promise.resolve().then(async () => {
				try {
					const result = await fcn(...args)
					cb(null, result)
				} catch (/** @type {any} */ e) {
					this.logger.warn(`Error in client handler '${name}': ${e} ${e?.stack}`)
					if (cb) cb(e?.message ?? 'error', null)
				}
			})
		})
		return this
	}
}

class UIHandler {
	#logger = LogController.createLogger('UI/Handler')

	/**
	 * Socket.IO Server options
	 * @type {Partial<import('socket.io').ServerOptions>}
	 * @access private
	 */
	#socketIOOptions

	/**
	 * @type {IOServerType}
	 * @access private
	 */
	#httpIO
	/**
	 * @type {IOServerType | undefined}
	 * @access private
	 */
	#httpsIO

	/**
	 *
	 * @param {import('../Registry.js').default} registry
	 * @param {*} http
	 */
	constructor(registry, http) {
		this.registry = registry

		this.#socketIOOptions = {
			allowEIO3: true,
			maxHttpBufferSize: 100 * 1000 * 1000, // bytes. 100mb matches socket.io v2. while not entirely safe, its what it used to be so is good enough for now
			cors: {
				// Allow everything
				// @ts-ignore
				origin: (o, cb) => cb(null, o),
				credentials: true,
			},
		}

		this.#httpIO = new _io(http, this.#socketIOOptions)

		this.#httpIO.on('connect', this.#clientConnect.bind(this))
	}

	/**
	 * Setup a new socket client's events
	 * @param {Socket<IOListenEvents, IOEmitEvents>} rawClient - the client socket
	 * @access public
	 */
	#clientConnect(rawClient) {
		this.#logger.debug(`socket ${rawClient.id} connected`)

		const client = new ClientSocket(rawClient, this.#logger)

		client.onPromise('app-version-info', () => {
			return {
				appVersion: this.registry.appInfo.appVersion,
				appBuild: this.registry.appInfo.appBuild,
			}
		})

		LogController.clientConnect(client)
		this.registry.ui?.clientConnect(client)
		this.registry.data?.clientConnect(client)
		this.registry.page.clientConnect(client)
		this.registry.controls.clientConnect(client)
		this.registry.preview.clientConnect(client)
		this.registry.surfaces.clientConnect(client)
		this.registry.instance.clientConnect(client)
		this.registry.cloud?.clientConnect(client)
		this.registry.services.clientConnect(client)

		client.on('disconnect', () => {
			this.#logger.debug('socket ' + client.id + ' disconnected')
		})
	}

	/**
	 * Send a message to all connected clients
	 * @template {keyof IOEmitEvents} T
	 * @param {T} event Name of the event
	 * @param {Parameters<IOEmitEvents[T]>} args Arguments of the event
	 */
	emit(event, ...args) {
		this.#httpIO.emit(event, ...args)

		if (this.#httpsIO) {
			this.#httpsIO.emit(event, ...args)
		}
	}

	/**
	 * Send a message to all connected clients in a room
	 * @template {keyof IOEmitEvents} T
	 * @param {string} room Name of the room
	 * @param {T} event Name of the event
	 * @param {Parameters<IOEmitEvents[T]>} args Arguments of the event
	 */
	emitToRoom(room, event, ...args) {
		this.#httpIO.to(room).emit(event, ...args)

		if (this.#httpsIO) {
			this.#httpsIO.to(room).emit(event, ...args)
		}
	}

	/**
	 * Count the number of members in a room
	 * @param {string} room
	 * @returns {number}
	 */
	countRoomMembers(room) {
		let clientsInRoom = 0

		const httpRoom = this.#httpIO.sockets.adapter.rooms.get(room)
		if (httpRoom) clientsInRoom += httpRoom.size

		if (this.#httpsIO) {
			const httpsRoom = this.#httpsIO.sockets.adapter.rooms.get(room)
			if (httpsRoom) clientsInRoom += httpsRoom.size
		}

		return clientsInRoom
	}

	/**
	 * Bind to the https server
	 * @param {*} https
	 */
	bindToHttps(https) {
		if (https) {
			this.#httpsIO = new _io(https, this.#socketIOOptions)

			this.#httpsIO.on('connect', this.#clientConnect.bind(this))
		}
	}
}

export default UIHandler
