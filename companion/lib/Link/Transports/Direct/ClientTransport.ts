import type { TLSSocket } from 'node:tls'
import { WebSocket } from 'ws'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { LinkTransportContext } from '../Types.js'
import { normaliseFingerprint } from './Certificate.js'
import { DirectTransportBase } from './DirectTransportBase.js'
import { DIRECT_MAX_PAYLOAD } from './ServerTransport.js'

export type DirectClientTransportConfig = {
	url: string
	fingerprint: string
}

const RECONNECT_DELAY_MS = 5_000

/**
 * Connects directly to another installation that is accepting direct connections.
 *
 * The connection is encrypted, but the server's certificate is self-signed, so it is only authenticated if the
 * user has pinned its fingerprint.
 * TODO: this needs a proper authentication story (eg a pairing flow exchanging keys) before it can be called secure.
 */
export class DirectClientTransport extends DirectTransportBase {
	readonly #url: string
	readonly #pinnedFingerprint: string

	#socket: WebSocket | null = null
	#reconnectTimer: NodeJS.Timeout | null = null
	#observedFingerprint: string | null = null
	/** Why we closed the connection ourselves, which explains the error the socket then reports */
	#rejectReason: string | null = null
	#isOpen = false
	#destroyed = false

	constructor(context: LinkTransportContext, config: DirectClientTransportConfig) {
		super(context)
		this.#url = config.url
		this.#pinnedFingerprint = normaliseFingerprint(config.fingerprint)

		this.#connect()
	}

	#connect(): void {
		this.#reconnectTimer = null
		if (this.#destroyed) return

		this.#rejectReason = null
		this.context.setStatus('connecting', null)
		this.#updateInfo()

		const socket = new WebSocket(this.#url, {
			// The certificate is self-signed, so it is checked against the pinned fingerprint instead
			rejectUnauthorized: false,
			maxPayload: DIRECT_MAX_PAYLOAD,
			handshakeTimeout: 10_000,
		})
		this.#socket = socket

		socket.on('upgrade', (res) => {
			const tlsSocket = res.socket as TLSSocket
			if (typeof tlsSocket.getPeerCertificate !== 'function') {
				this.#rejectReason = 'Connection is not encrypted, the url must start with wss://'
				socket.terminate()
				return
			}

			const fingerprint = tlsSocket.getPeerCertificate().fingerprint256
			this.#observedFingerprint = fingerprint ?? null
			if (this.#pinnedFingerprint && normaliseFingerprint(fingerprint ?? '') !== this.#pinnedFingerprint) {
				this.#rejectReason =
					'The certificate fingerprint does not match the pinned one. If the other installation was reset, update the pinned fingerprint'
				this.#updateInfo()
				socket.terminate()
			}
		})

		socket.on('open', () => {
			this.#isOpen = true
			this.context.logger.info(`Connected to ${this.#url}`)
			this.context.setStatus(
				'connected',
				this.#pinnedFingerprint ? null : 'The certificate is not pinned, so the other end is not verified'
			)
			this.#updateInfo()
			this.attachSocket(socket, this.#url)
		})

		socket.on('error', (e) => {
			this.context.logger.debug(`Connection error: ${stringifyError(e)}`)
			this.context.setStatus('error', this.#rejectReason ?? stringifyError(e))
		})

		socket.on('close', () => {
			if (this.#socket !== socket) return
			const wasOpen = this.#isOpen
			this.#isOpen = false
			this.#socket = null
			if (this.#destroyed) return

			if (this.#rejectReason) {
				this.context.setStatus('error', this.#rejectReason)
			} else if (wasOpen) {
				this.context.setStatus('connecting', 'Connection lost, retrying')
			}

			this.#reconnectTimer = setTimeout(() => this.#connect(), RECONNECT_DELAY_MS)
		})
	}

	#updateInfo(): void {
		const info = [{ label: 'Address', value: this.#url }]
		if (this.#observedFingerprint) {
			info.push({ label: 'Server certificate fingerprint', value: this.#observedFingerprint })
		}
		this.context.setInfo(info)
	}

	protected connectionsChanged(): void {
		// Status is driven by the socket events instead
	}

	async destroy(): Promise<void> {
		this.#destroyed = true

		if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer)
		this.#reconnectTimer = null

		this.#socket?.terminate()
		this.#socket = null
	}
}
