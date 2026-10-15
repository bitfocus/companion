import type { WebSocket } from 'ws'
import type { LinkPublishOptions, LinkTransport, LinkTransportContext } from '../Types.js'
import { PeerConnectionBus } from './PeerConnectionBus.js'

/** How often a direct connection is checked for liveness */
const KEEPALIVE_INTERVAL_MS = 10_000

/**
 * Common parts of the direct server and client: tracking our subscriptions and retained messages, and fanning
 * them out to the connections.
 */
export abstract class DirectTransportBase implements LinkTransport {
	protected readonly context: LinkTransportContext

	readonly #retained = new Map<string, string>()
	readonly #subscriptions = new Set<string>()
	readonly #buses = new Set<PeerConnectionBus>()

	protected get connectionCount(): number {
		return this.#buses.size
	}

	constructor(context: LinkTransportContext) {
		this.context = context
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

	abstract destroy(): Promise<void>

	/** Called when the number of open connections changes */
	protected abstract connectionsChanged(): void

	/**
	 * Start exchanging messages over an open socket. Liveness is checked with websocket pings, and the socket is
	 * terminated if it stops responding
	 */
	protected attachSocket(socket: WebSocket, name: string): void {
		const bus = new PeerConnectionBus(
			(frame) => socket.send(frame),
			(topic, payload) => this.context.receive(topic, payload),
			this.#retained,
			this.#subscriptions
		)
		this.#buses.add(bus)

		let alive = true
		const keepalive = setInterval(() => {
			if (!alive) {
				this.context.logger.info(`Connection to ${name} timed out`)
				socket.terminate()
				return
			}
			alive = false
			socket.ping()
		}, KEEPALIVE_INTERVAL_MS)

		socket.on('pong', () => {
			alive = true
		})
		socket.on('message', (data, isBinary) => {
			alive = true
			if (isBinary) return

			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			const result = bus.handleFrame(data.toString())
			if (!result.ok) this.context.logger.warn(`Invalid frame from ${name}: ${result.error}`)
		})
		socket.on('close', () => {
			clearInterval(keepalive)
			this.#buses.delete(bus)
			bus.close()
			this.connectionsChanged()
		})

		this.connectionsChanged()
	}
}
