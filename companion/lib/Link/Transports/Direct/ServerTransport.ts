import https from 'node:https'
import { WebSocketServer } from 'ws'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { GLOBAL_BIND_ADDRESS } from '../../../Resources/Constants.js'
import type { LinkTransportContext } from '../Types.js'
import { loadOrCreateDirectCertificate, type DirectServerCertificate } from './Certificate.js'
import { DirectTransportBase } from './DirectTransportBase.js'

export type DirectServerTransportConfig = {
	port: number
}

/** Largest frame accepted, comfortably above a large button bitmap */
export const DIRECT_MAX_PAYLOAD = 4 * 1024 * 1024

/**
 * Accepts direct connections from other installations, over a websocket secured with a self-signed certificate.
 *
 * This does not relay between the installations connected to it: each connection is a link between this
 * installation and one other.
 */
export class DirectServerTransport extends DirectTransportBase {
	readonly #port: number

	#httpsServer: https.Server | null = null
	#wsServer: WebSocketServer | null = null
	#certificate: DirectServerCertificate | null = null
	#destroyed = false

	constructor(context: LinkTransportContext, config: DirectServerTransportConfig) {
		super(context)
		this.#port = config.port

		context.setStatus('connecting', 'Starting')
		this.#listen().catch((e) => {
			context.logger.error(`Failed to start: ${stringifyError(e)}`)
			context.setStatus('error', stringifyError(e))
		})
	}

	async #listen(): Promise<void> {
		this.#certificate = await loadOrCreateDirectCertificate(this.context.storage)
		if (this.#destroyed) return

		const httpsServer = https.createServer({ cert: this.#certificate.cert, key: this.#certificate.key })
		this.#httpsServer = httpsServer

		const wsServer = new WebSocketServer({ server: httpsServer, maxPayload: DIRECT_MAX_PAYLOAD })
		this.#wsServer = wsServer

		wsServer.on('connection', (socket, req) => {
			const name = `${req.socket.remoteAddress}:${req.socket.remotePort}`
			this.context.logger.info(`Accepted connection from ${name}`)
			socket.on('error', (e) => this.context.logger.debug(`Socket error from ${name}: ${stringifyError(e)}`))
			this.attachSocket(socket, name)
		})

		// Errors of the https server are re-emitted here, and are handled below
		wsServer.on('error', () => {})
		httpsServer.on('error', (e) => {
			this.context.logger.error(`Server error: ${stringifyError(e)}`)
			this.context.setStatus('error', stringifyError(e))
		})
		httpsServer.listen(this.#port, GLOBAL_BIND_ADDRESS, () => {
			this.context.logger.info(`Listening on port ${this.#port}`)
			this.connectionsChanged()
		})
	}

	protected connectionsChanged(): void {
		if (this.#destroyed || !this.#certificate) return

		this.context.setStatus('connected', null)
		this.context.setInfo([
			{ label: 'Port', value: String(this.#port) },
			{ label: 'Certificate fingerprint', value: this.#certificate.fingerprint, copyable: true },
			{ label: 'Connected installations', value: String(this.connectionCount) },
		])
	}

	async destroy(): Promise<void> {
		this.#destroyed = true

		const wsServer = this.#wsServer
		const httpsServer = this.#httpsServer
		this.#wsServer = null
		this.#httpsServer = null

		if (wsServer) {
			for (const client of wsServer.clients) client.terminate()
			wsServer.close()
		}
		if (httpsServer) {
			await new Promise<void>((resolve) => httpsServer.close(() => resolve()))
		}
	}
}
