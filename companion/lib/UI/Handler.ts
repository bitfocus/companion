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

import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import type { Server as HttpServer } from 'http'
import type { Server as HttpsServer } from 'https'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { WebSocketServer } from 'ws'
import { AppRouter, createTrpcWsContext } from './TRPC.js'
import { nanoid } from 'nanoid'

export class UIHandler {
	readonly #logger = LogController.createLogger('UI/Handler')

	#http: HttpServer

	#wss = new WebSocketServer({
		noServer: true,
		path: '/trpc',
	})
	#broadcastDisconnect?: () => void

	constructor(_appInfo: AppInfo, http: HttpServer) {
		this.#http = http
	}

	/**
	 * Bind to the https server
	 */
	bindToHttps(https: HttpsServer): void {
		this.#bindToHttpServer(https)
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

		this.#bindToHttpServer(this.#http)

		this.#wss.on('connection', (ws) => {
			// TODO: make this the same as ctx.clientId
			const socketId = nanoid()
			this.#logger.debug(`trpc socket ${socketId} connected`)
			ws.once('close', () => {
				this.#logger.debug(`trpc socket ${socketId} disconnected`)
			})

			onConnection()
		})
	}

	#bindToHttpServer(httpServer: HttpServer): void {
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
