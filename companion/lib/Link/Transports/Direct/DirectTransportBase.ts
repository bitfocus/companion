import type { KeyPair as NoiseKeyPair } from 'noise-handshake/dh.js'
import type { WebSocket } from 'ws'
import { z } from 'zod'
import { loadOrCreateNoiseKeyPair } from '../Secure/NoiseKey.js'
import type { SecureChannel } from '../Secure/SecureChannel.js'
import type { LinkTransport, LinkTransportContext } from '../Types.js'

/** How often a direct connection is checked for liveness */
const KEEPALIVE_INTERVAL_MS = 10_000

/** Largest message accepted over a direct connection, comfortably above a large button bitmap */
export const DIRECT_MAX_MESSAGE_SIZE = 4 * 1024 * 1024

/** Largest message accepted from the other end until it is trusted, comfortably above what is said while pairing */
export const DIRECT_MAX_UNTRUSTED_MESSAGE_SIZE = 4 * 1024

/** How long the Noise handshake may take */
export const DIRECT_HANDSHAKE_TIMEOUT_MS = 10_000

/**
 * Frames exchanged over a direct connection, which is between exactly two installations, so nothing needs
 * addressing: the other end is who the handshake proved it is
 */
const DirectFrameSchema = z.discriminatedUnion('op', [
	/** The announcement of the sender, or null when it is going away */
	z.object({ op: z.literal('announce'), payload: z.string().nullable() }),
	z.object({ op: z.literal('message'), payload: z.string() }),
])
type DirectFrame = z.infer<typeof DirectFrameSchema>

/**
 * Common parts of the direct server and client: the identity key, keeping the sockets alive, and once a connection
 * is trusted, exchanging Link messages over it.
 */
export abstract class DirectTransportBase implements LinkTransport {
	protected readonly context: LinkTransportContext
	/** The Noise static key pair, signed by the installation identity in every handshake */
	protected readonly noiseKeyPair: NoiseKeyPair

	/** Our announcement, sent to every connection as it is linked */
	#announcement: string | null = null
	/**
	 * The linked connections to each installation, newest last. Usually one, but a reconnect can briefly overlap the
	 * connection it replaces
	 */
	readonly #links = new Map<string, SecureChannel[]>()

	protected get linkedCount(): number {
		let count = 0
		for (const channels of this.#links.values()) count += channels.length
		return count
	}

	constructor(context: LinkTransportContext) {
		this.context = context
		this.noiseKeyPair = loadOrCreateNoiseKeyPair(context.storage)
	}

	announce(payload: string | null): void {
		this.#announcement = payload
		for (const channels of this.#links.values()) {
			for (const channel of channels) sendFrame(channel, { op: 'announce', payload })
		}
	}

	send(peerId: string, payload: string): void {
		const channel = this.#links.get(peerId)?.at(-1)
		if (channel) sendFrame(channel, { op: 'message', payload })
	}

	abstract handleSectionAction(entryId: string, actionId: string, input: string | null): Promise<string | null>

	abstract destroy(): Promise<void>

	/** Called when the number of linked connections changes */
	protected abstract linksChanged(): void

	/**
	 * Check a socket for liveness with websocket pings, terminating it if it stops responding. Started as soon as
	 * the socket opens, so that a connection waiting for pairing is also cleaned up
	 */
	protected keepAlive(channelSocket: WebSocket, name: string): void {
		let alive = true
		const timer = setInterval(() => {
			if (!alive) {
				this.context.logger.info(`Connection to ${name} timed out`)
				channelSocket.terminate()
				return
			}
			alive = false
			channelSocket.ping()
		}, KEEPALIVE_INTERVAL_MS)

		channelSocket.on('pong', () => {
			alive = true
		})
		channelSocket.on('message', () => {
			alive = true
		})
		channelSocket.on('close', () => clearInterval(timer))
	}

	/** Start exchanging Link messages over a trusted channel */
	protected link(channel: SecureChannel, name: string): void {
		// The other end proved who it is in the handshake, so everything over this channel is from it
		const peerId = channel.remoteLinkId
		// Trusted now, so it may send button images
		channel.acceptMessagesUpTo(DIRECT_MAX_MESSAGE_SIZE)

		let channels = this.#links.get(peerId)
		if (!channels) {
			channels = []
			this.#links.set(peerId, channels)
		}
		channels.push(channel)

		channel.setHandler((text) => {
			const parsed = parseFrame(text)
			if (!parsed.ok) {
				this.context.logger.warn(`Invalid frame from ${name}: ${parsed.error}`)
			} else if (parsed.frame.op === 'announce') {
				this.context.receiveAnnouncement(peerId, parsed.frame.payload)
			} else {
				this.context.receive(parsed.frame.payload, { peerId })
			}
		})
		channel.onClose(() => {
			const remaining = this.#links.get(peerId)?.filter((other) => other !== channel) ?? []
			if (remaining.length > 0) {
				this.#links.set(peerId, remaining)
			} else {
				// Its last connection has gone, which is as good as a goodbye
				this.#links.delete(peerId)
				this.context.receiveAnnouncement(peerId, null)
			}
			this.linksChanged()
		})

		if (this.#announcement !== null) sendFrame(channel, { op: 'announce', payload: this.#announcement })
		this.linksChanged()
	}
}

function sendFrame(channel: SecureChannel, frame: DirectFrame): void {
	channel.send(JSON.stringify(frame))
}

function parseFrame(raw: string): { ok: true; frame: DirectFrame } | { ok: false; error: string } {
	let json: unknown
	try {
		json = JSON.parse(raw)
	} catch {
		return { ok: false, error: 'Invalid JSON' }
	}
	const parsed = DirectFrameSchema.safeParse(json)
	if (!parsed.success) return { ok: false, error: z.prettifyError(parsed.error) }
	return { ok: true, frame: parsed.data }
}
