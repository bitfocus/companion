import type { NoiseKeyPair } from 'noise-handshake'
import type { LinkPublishOptions, LinkTransport, LinkTransportContext } from '../Types.js'
import { loadOrCreateDirectIdentity } from './Identity.js'
import { PeerConnectionBus } from './PeerConnectionBus.js'
import type { SecureChannel } from './SecureChannel.js'

/** How often a direct connection is checked for liveness */
const KEEPALIVE_INTERVAL_MS = 10_000

/** Largest message accepted over a direct connection, comfortably above a large button bitmap */
export const DIRECT_MAX_MESSAGE_SIZE = 4 * 1024 * 1024

/** How long the Noise handshake may take */
export const DIRECT_HANDSHAKE_TIMEOUT_MS = 10_000

/**
 * Common parts of the direct server and client: the identity key, keeping the sockets alive, and once a connection
 * is trusted, exchanging Link messages over it.
 */
export abstract class DirectTransportBase implements LinkTransport {
	protected readonly context: LinkTransportContext
	protected readonly identity: NoiseKeyPair

	readonly #retained = new Map<string, string>()
	readonly #subscriptions = new Set<string>()
	readonly #buses = new Set<PeerConnectionBus>()

	protected get linkedCount(): number {
		return this.#buses.size
	}

	constructor(context: LinkTransportContext) {
		this.context = context
		this.identity = loadOrCreateDirectIdentity(context.storage)
	}

	publish(topic: string, payload: string, options: LinkPublishOptions): void {
		if (options.retain) {
			if (payload) this.#retained.set(topic, payload)
			else this.#retained.delete(topic)
		}

		for (const bus of this.#buses) bus.publish(topic, payload, options.retain)
	}

	subscribe(pattern: string): void {
		this.#subscriptions.add(pattern)
		for (const bus of this.#buses) bus.subscribe(pattern)
	}

	unsubscribe(pattern: string): void {
		this.#subscriptions.delete(pattern)
		for (const bus of this.#buses) bus.unsubscribe(pattern)
	}

	abstract handleAction(entryId: string, actionId: string, input: string | null): Promise<string | null>

	abstract destroy(): Promise<void>

	/** Called when the number of linked connections changes */
	protected abstract linksChanged(): void

	/**
	 * Check a socket for liveness with websocket pings, terminating it if it stops responding. Started as soon as
	 * the socket opens, so that a connection waiting for pairing is also cleaned up
	 */
	protected keepAlive(channelSocket: SecureChannel['socket'], name: string): void {
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
		const bus = new PeerConnectionBus(
			(frame) => channel.send(frame),
			(topic, payload) => this.context.receive(topic, payload),
			this.#retained,
			this.#subscriptions
		)
		this.#buses.add(bus)

		channel.setHandler((text) => {
			const result = bus.handleFrame(text)
			if (!result.ok) this.context.logger.warn(`Invalid frame from ${name}: ${result.error}`)
		})
		channel.socket.on('close', () => {
			this.#buses.delete(bus)
			bus.close()
			this.linksChanged()
		})

		this.linksChanged()
	}
}
