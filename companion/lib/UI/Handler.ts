/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { Server as SocketIOServer, Server, Socket } from 'socket.io'
import LogController, { Logger } from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import type { Server as HttpServer } from 'http'
import type { Server as HttpsServer } from 'https'
import { EventEmitter } from 'events'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'
import { AppRouter, createTrpcWsContext } from './TRPC.js'
import { nanoid } from 'nanoid'

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
		void this.#socket.join(room)
	}
	/**
	 * Leave a room
	 */
	leave(room: string): void {
		void this.#socket.leave(room)
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
				void fcn(...args)
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
			void Promise.resolve().then(async () => {
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

interface UIHandlerEvents {
	clientConnect: [client: ClientSocket]
}

export class UIHandler extends EventEmitter<UIHandlerEvents> {
	readonly #logger = LogController.createLogger('UI/Handler')

	/**
	 * Socket.IO Server options
	 */
	readonly #socketIOOptions: Partial<import('socket.io').ServerOptions>

	readonly #httpIO: IOServerType
	#httpsIO: IOServerType | undefined

	#http: HttpServer

	#wss = new WebSocketServer({
		noServer: true,
		path: '/trpc',
	})
	#broadcastDisconnect?: () => void

	constructor(_appInfo: AppInfo, http: HttpServer) {
		super()

		this.#socketIOOptions = {
			allowEIO3: true,
			maxHttpBufferSize: 5 * 1024 * 1024, // bytes. The multipart uploader is typically set to use 1MB chunks, give it some space for overhead
			cors: {
				// Allow everything
				origin: (o, cb) => cb(null, o),
				credentials: true,
			},
		}

		this.#http = http
		this.#httpIO = new SocketIOServer(http, this.#socketIOOptions)

		this.#httpIO.on('connect', this.#clientConnect.bind(this))
	}

	/**
	 * Setup a new socket client's events
	 */
	#clientConnect(rawClient: Socket<IOListenEvents, IOEmitEvents>): void {
		this.#logger.debug(`socket ${rawClient.id} connected`)

		const client = new ClientSocket(rawClient, this.#logger)

		this.emit('clientConnect', client)

		client.on('disconnect', () => {
			this.#logger.debug('socket ' + client.id + ' disconnected')
		})
	}

	/**
	 * Send a message to all connected clients
	 */
	emitToAll<T extends keyof IOEmitEvents>(event: T, ...args: Parameters<IOEmitEvents[T]>): void {
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

			this.#bindToHtttpServer(https)
		}
	}

	#boundTrpcRouter = false
	bindTrpcRouter(trpcRouter: AppRouter, onConnection: () => void): void {
		if (this.#boundTrpcRouter) throw new Error('tRPC router already bound')
		this.#boundTrpcRouter = true

		// TODO - this shouldnt be here like this..
		const handler = applyWSSHandler({
			wss: this.#wss as any,
			router: trpcRouter,
			createContext: createTrpcWsContext,
			// Enable heartbeat messages to keep connection open (disabled by default)
			keepAlive: {
				enabled: true,
				// server ping message interval in milliseconds
				pingMs: 30000,
				// connection is terminated if pong message is not received in this many milliseconds
				pongWaitMs: 5000,
			},
			onError: (error) => {
				this.#logger.error(`tRPC error: ${error.error.message} ${error.error.stack}`)
			},
		})

		this.#broadcastDisconnect = handler.broadcastReconnectNotification

		this.#bindToHtttpServer(this.#http)

		this.#wss.on('connection', (ws) => {
			const socketId = nanoid()
			this.#logger.debug(`trpc socket ${socketId} connected`)
			ws.once('close', () => {
				this.#logger.debug(`trpc socket ${socketId} disconnected`)
			})

			onConnection()
		})
	}

	#bindToHtttpServer(httpServer: HttpServer): void {
		httpServer.on('upgrade', (request, socket, head) => {
			// TODO - is this guard needed?
			if (request.url === '/trpc') {
				this.#wss.handleUpgrade(request, socket, head, (websocket) => {
					this.#wss.emit('connection', websocket, request)
				})
			}
		})
	}

	close(): void {
		this.#broadcastDisconnect?.()
		this.#wss.close()
	}
}
