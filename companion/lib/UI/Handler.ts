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

import { Server as SocketIOServer, Server, Socket } from 'socket.io'
import LogController, { Logger } from '../Log/Controller.js'
import type { Registry } from '../Registry.js'
import type { Server as HttpServer } from 'http'
import type { Server as HttpsServer } from 'https'

type IOListenEvents = import('@companion-app/shared/SocketIO.js').ClientToBackendEventsListenMap
type IOEmitEvents = import('@companion-app/shared/SocketIO.js').BackendToClientEventsMap
type IOListenEventsNoResponse = import('@companion-app/shared/SocketIO.js').ClientToBackendEventsWithNoResponse
type IOListenEventsWithResponse = import('@companion-app/shared/SocketIO.js').ClientToBackendEventsWithPromiseResponse
type IOServerType = Server<IOListenEvents, IOEmitEvents>

/**
 * Wrapper around a socket.io client socket, to provide a promise based api for async calls
 */
export class ClientSocket {
	/**
	 * Logger
	 */
	private readonly logger: Logger

	/**
	 * Socket.io socket
	 */
	readonly #socket: Socket<IOListenEvents, IOEmitEvents>

	constructor(socket: Socket<IOListenEvents, IOEmitEvents>, logger: Logger) {
		this.#socket = socket
		this.logger = logger
	}

	/**
	 * Unique id for the socket
	 */
	get id(): string {
		return this.#socket.id
	}

	/**
	 * Join a room
	 */
	join(room: string): void {
		this.#socket.join(room)
	}
	/**
	 * Leave a room
	 */
	leave(room: string): void {
		this.#socket.leave(room)
	}

	/**
	 * Send a message to the client
	 */
	emit<T extends keyof IOEmitEvents>(name: T, ...args: Parameters<IOEmitEvents[T]>): void {
		this.#socket.emit(name, ...args)
	}

	/**
	 * Listen to an event
	 */
	on<T extends keyof IOListenEventsNoResponse>(name: T, fcn: IOListenEvents[T]): ClientSocket {
		// @ts-expect-error Types are hard to get correct
		this.#socket.on(name, (...args) => {
			try {
				// @ts-expect-error Types are hard
				fcn(...args)
			} catch (e: any) {
				this.logger.warn(`Error in client handler '${name}': ${e} ${e?.stack}`)
			}
		})
		return this
	}
	/**
	 * A promise based alternative to the `on` method, for methods which want to return a value.
	 * Note: it expects the first parameter of the call to be the callback
	 */
	onPromise<T extends keyof IOListenEventsWithResponse>(name: T, fcn: IOListenEvents[T]): ClientSocket {
		// @ts-expect-error Types are hard
		this.#socket.on(name, (args, cb) => {
			Promise.resolve().then(async () => {
				try {
					const result = await fcn(...args)
					cb(null, result)
				} catch (e: any) {
					this.logger.warn(`Error in client handler '${name}': ${e} ${e?.stack}`)
					if (cb) cb(e?.message ?? 'error', null)
				}
			})
		})
		return this
	}
}

export class UIHandler {
	readonly #logger = LogController.createLogger('UI/Handler')

	readonly #registry: Registry

	/**
	 * Socket.IO Server options
	 */
	readonly #socketIOOptions: Partial<import('socket.io').ServerOptions>

	readonly #httpIO: IOServerType
	#httpsIO: IOServerType | undefined

	constructor(registry: Registry, http: HttpServer) {
		this.#registry = registry

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

		this.#httpIO = new SocketIOServer(http, this.#socketIOOptions)

		this.#httpIO.on('connect', this.#clientConnect.bind(this))
	}

	/**
	 * Setup a new socket client's events
	 */
	#clientConnect(rawClient: Socket<IOListenEvents, IOEmitEvents>): void {
		this.#logger.debug(`socket ${rawClient.id} connected`)

		const client = new ClientSocket(rawClient, this.#logger)

		client.onPromise('app-version-info', () => {
			return {
				appVersion: this.#registry.appInfo.appVersion,
				appBuild: this.#registry.appInfo.appBuild,
			}
		})

		LogController.clientConnect(client)
		this.#registry.ui?.clientConnect(client)
		this.#registry.data?.clientConnect(client)
		this.#registry.page.clientConnect(client)
		this.#registry.controls.clientConnect(client)
		this.#registry.preview.clientConnect(client)
		this.#registry.surfaces.clientConnect(client)
		this.#registry.instance.clientConnect(client)
		this.#registry.cloud?.clientConnect(client)
		this.#registry.services.clientConnect(client)

		client.on('disconnect', () => {
			this.#logger.debug('socket ' + client.id + ' disconnected')
		})
	}

	/**
	 * Send a message to all connected clients
	 */
	emit<T extends keyof IOEmitEvents>(event: T, ...args: Parameters<IOEmitEvents[T]>): void {
		this.#httpIO.emit(event, ...args)

		if (this.#httpsIO) {
			this.#httpsIO.emit(event, ...args)
		}
	}

	/**
	 * Send a message to all connected clients in a room
	 */
	emitToRoom<T extends keyof IOEmitEvents>(room: string, event: T, ...args: Parameters<IOEmitEvents[T]>): void {
		this.#httpIO.to(room).emit(event, ...args)

		if (this.#httpsIO) {
			this.#httpsIO.to(room).emit(event, ...args)
		}
	}

	/**
	 * Count the number of members in a room
	 */
	countRoomMembers(room: string): number {
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
	 */
	bindToHttps(https: HttpsServer): void {
		if (https) {
			this.#httpsIO = new SocketIOServer(https, this.#socketIOOptions)

			this.#httpsIO.on('connect', this.#clientConnect.bind(this))
		}
	}
}
