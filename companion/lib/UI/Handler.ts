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
import net from 'node:net'
import { applyWSSHandler } from '@trpc/server/adapters/ws'
import { nanoid } from 'nanoid'
import { WebSocketServer } from 'ws'
import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import { createTrpcWsContextFactory, makeIsTrustedProxyAddress, type AppRouter } from './TRPC.js'

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

/**
 * Whether a socket peer address is loopback (the request physically arrived over 127.0.0.0/8 or ::1).
 * Node may report an IPv4-mapped IPv6 address (`::ffff:127.0.0.1`) for loopback, so we strip that prefix.
 */
function isLoopbackAddress(address: string | undefined): boolean {
	if (!address) return false
	const addr = address
		.trim()
		.toLowerCase()
		.replace(/^::ffff:/, '')
	return addr === '::1' || addr.startsWith('127.')
}

/**
 * Whether a `Host` header authority (`host[:port]`) names loopback - i.e. `localhost`, a `127.x` address
 * or `[::1]`. Returns false for anything else (including a real hostname like `evil.com`).
 */
function isLoopbackHostname(host: string): boolean {
	let hostname: string
	try {
		// Wrap in a url so port/IPv6-bracket parsing is handled for us. `hostname` is lowercased.
		hostname = new URL(`http://${host.trim()}`).hostname.toLowerCase()
	} catch (_e) {
		return false
	}
	if (hostname === 'localhost') return true
	// URL keeps IPv6 literals in brackets (e.g. `[::1]`); strip them to get the raw address.
	const ip = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
	// Reject anything that is not a real IP literal - a domain like `127.evil.com` returns 0 here.
	if (net.isIP(ip) === 0) return false
	return isLoopbackAddress(ip)
}

/**
 * Anti-DNS-rebinding guard, scoped to loopback connections only. Returns true if the request should
 * be allowed through.
 *
 * A loopback rebinding attack works by serving a page from `http://evil.com:PORT`, then repointing
 * `evil.com` DNS to `127.0.0.1`: the browser then connects to loopback Companion but sends
 * `Host: evil.com`, and (being same-origin from the browser's view) can read the response - bypassing
 * CORS entirely. The legitimate loopback UI always sends a loopback `Host` (`localhost`/`127.0.0.1`),
 * so on a loopback connection we require the `Host` to itself be loopback.
 *
 * Non-loopback (LAN/remote) connections are not checked: rebinding to a specific internal IP+port is
 * impractical, and policing it would need a hostname allowlist. Requests from a trusted proxy are also
 * skipped - the proxy connects over (often loopback) but legitimately forwards external hosts, and we
 * can't distinguish that from a rebind without a hostname allowlist. Note that if loopback itself is
 * configured as a trusted proxy, all loopback connections skip the check (unavoidable - the local
 * proxy and a local browser are indistinguishable at that point).
 */
export function isLoopbackHostAllowed(
	remoteAddress: string | undefined,
	host: string | undefined,
	options: { isTrustedProxy: boolean }
): boolean {
	// Requests genuinely forwarded by a trusted proxy legitimately carry an external Host - skip them.
	if (options.isTrustedProxy) return true
	// Only police connections that physically arrived over loopback - those are the only ones a
	// localhost rebinding attack can reach.
	if (!isLoopbackAddress(remoteAddress)) return true
	if (!host) return false
	return isLoopbackHostname(host)
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
	 * Whether a given peer address is one of the configured trusted proxies. Used both to decide whether
	 * to trust `X-Forwarded-Host` for the WebSocket Origin check, and for the DNS-rebinding guard.
	 */
	readonly #isTrustedProxyAddress: (address: string | undefined) => boolean

	constructor(appInfo: AppInfo, http: HttpServer) {
		this.#appInfo = appInfo
		this.#http = http
		this.#isTrustedProxyAddress = makeIsTrustedProxyAddress(appInfo.options.trustedProxies)
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
				// Whether this upgrade arrived from a trusted proxy peer. Resolved once and reused below.
				const isTrustedProxy = this.#isTrustedProxyAddress(request.socket.remoteAddress)

				// Reject cross-origin upgrades to prevent Cross-Site WebSocket Hijacking.
				// Only trust X-Forwarded-Host when this request actually arrived from a trusted proxy peer -
				// otherwise a client connecting directly could spoof it to make its Origin look same-origin.
				if (!isOriginAllowed(request.headers, { trustForwardedHost: isTrustedProxy })) {
					this.#logger.warn(`Rejected tRPC WebSocket upgrade from disallowed origin "${request.headers.origin}"`)
					try {
						if (socket.writable) socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
					} catch (_e) {
						// Socket may already be destroyed
					}
					socket.destroy()
					return
				}

				// Reject loopback connections whose Host names a non-loopback domain - the signature of a
				// DNS rebinding attack against localhost. Without this, rebinding bypasses the Origin check
				// above (Origin and Host both become the attacker's domain, so they match).
				if (!isLoopbackHostAllowed(request.socket.remoteAddress, request.headers.host, { isTrustedProxy })) {
					this.#logger.warn(
						`Rejected tRPC WebSocket upgrade from loopback with disallowed host "${request.headers.host}"`
					)
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
