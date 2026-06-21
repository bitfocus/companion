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

import type { Server as HttpServer } from 'node:http'
import type { Server as HttpsServer } from 'node:https'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { nanoid } from 'nanoid'
import { WebSocketServer } from 'ws'
import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import { createTrpcWsContextFactory, parseTrustedProxies, type AppRouter } from './TRPC.js'

/**
 * Check whether an HTTP upgrade request url is for the trpc WebSocket endpoint.
 * Matches on the pathname only, so query strings and a trailing slash are accepted.
 */
export function matchUpgradePathname(url: string | undefined): boolean {
	let pathname: string | null = null
	try {
		pathname = new URL(url ?? '', 'http://localhost').pathname
	} catch (_e) {
		pathname = null
	}

	return pathname === '/trpc' || pathname === '/trpc/'
}

/**
 * Normalise a `Host`/`X-Forwarded-Host` style authority (`host[:port]`) for comparison:
 * lowercase, trimmed. We can't strip a default port here as we don't know the scheme - that is
 * handled on the Origin side (see `isOriginAllowed`), which the browser keeps consistent with Host.
 */
function normalizeHostHeader(host: string): string {
	return host.trim().toLowerCase()
}

/**
 * Validate the `Origin` of a WebSocket upgrade request to prevent Cross-Site WebSocket Hijacking.
 * Returns true if the connection should be allowed.
 *
 * The tRPC api has no authentication, so without this any web page the user visits could open a
 * WebSocket to a reachable Companion and drive the entire api. WebSocket connections are not subject
 * to the same-origin policy / CORS the way fetch/XHR are, so we must check the Origin ourselves.
 *
 * The legitimate web UI always connects same-origin (it builds its url from `window.location.origin`),
 * so a matching Origin host == Host (or X-Forwarded-Host behind a trusted proxy) is the allow condition.
 * Clients that send no Origin header (non-browser tooling, tests) are allowed - CSWSH is a browser-only
 * attack, and such clients could spoof the Origin anyway.
 */
export function isOriginAllowed(
	headers: { origin?: string; host?: string; 'x-forwarded-host'?: string | string[] },
	options: { trustForwardedHost: boolean }
): boolean {
	const origin = headers.origin
	// No Origin header -> not a browser-driven cross-origin request. CSWSH cannot apply. Allow.
	if (origin === undefined) return true
	// Some browsers send "null" (file://, sandboxed iframes, some redirects). Never the real UI.
	if (origin === 'null') return false

	let originHost: string
	try {
		const url = new URL(origin)
		// `url.host` already strips the default port for the url's scheme (80 for http, 443 for https)
		// and lowercases the hostname, while keeping an explicit non-default port and IPv6 brackets.
		originHost = url.host.toLowerCase()
	} catch (_e) {
		// Malformed Origin
		return false
	}
	if (!originHost) return false

	// The host we expect the Origin to match: X-Forwarded-Host when behind a trusted proxy (the browser's
	// Origin reflects the external host, which the Host header forwarded to us may not), else the Host header.
	// Only trust X-Forwarded-Host when a trusted proxy is configured, so an untrusted client can't spoof it.
	const forwardedHost = headers['x-forwarded-host']
	const expectedHostHeader =
		options.trustForwardedHost && forwardedHost
			? (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost).split(',')[0]
			: headers.host

	if (!expectedHostHeader) return false

	return originHost === normalizeHostHeader(expectedHostHeader)
}

export class UIHandler {
	readonly #logger = LogController.createLogger('UI/Handler')

	#http: HttpServer

	#wss = new WebSocketServer({
		noServer: true,
		path: '/trpc',
	})
	#broadcastDisconnect?: () => void

	readonly #appInfo: AppInfo

	/**
	 * Whether a trusted proxy is configured. When true, `X-Forwarded-Host` is trusted for the Origin
	 * check on WebSocket upgrades (matching how the trpc ws context resolves X-Forwarded-For).
	 */
	readonly #trustForwardedHost: boolean

	constructor(appInfo: AppInfo, http: HttpServer) {
		this.#appInfo = appInfo
		this.#http = http
		this.#trustForwardedHost = parseTrustedProxies(appInfo.options.trustedProxies).length > 0
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
			createContext: createTrpcWsContextFactory(this.#appInfo.options.trustedProxies),
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
			if (matchUpgradePathname(request.url)) {
				// Reject cross-origin upgrades to prevent Cross-Site WebSocket Hijacking. The trpc api has no
				// authentication, so without this any web page the user visits could drive the entire api.
				if (!isOriginAllowed(request.headers, { trustForwardedHost: this.#trustForwardedHost })) {
					this.#logger.warn(`Rejected tRPC WebSocket upgrade from disallowed origin "${request.headers.origin}"`)
					try {
						if (socket.writable) socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
					} catch (_e) {
						// Socket may already be destroyed
					}
					socket.destroy()
					return
				}

				this.#wss.handleUpgrade(request, socket, head, (websocket) => {
					this.#wss.emit('connection', websocket, request)
				})
			} else {
				// Reject unknown upgrade requests instead of leaving the socket hanging,
				// which leaves browser clients stuck in CONNECTING forever
				try {
					if (socket.writable) socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n')
				} catch (_e) {
					// Socket may already be destroyed
				}
				socket.destroy()
			}
		})
	}

	close(): void {
		this.#broadcastDisconnect?.()
		this.#wss.close()
	}
}
