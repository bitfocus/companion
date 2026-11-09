import { nanoid } from 'nanoid'
import type { LinkPeerRegistry } from './PeerRegistry.js'
import { LINK_PING_TIMEOUT_MS } from './Protocol/v1/Timing.js'

interface PendingPing {
	peerId: string
	transportId: string
	/** When it was sent, by the monotonic clock */
	sentAt: number
}

/** A clock that only counts up, unaffected by changes to the time of day (eg `performance.now`), in ms */
export type LinkMonotonicClock = () => number

/**
 * Measures the round trip time to each peer over each transport it is reachable on, with ping messages, for the UI,
 * and from the time in each pong, how far apart our clocks are. Both are recorded in the peer registry.
 */
export class LinkPinger {
	readonly #peers: LinkPeerRegistry
	readonly #send: (peerId: string, transportId: string, nonce: string) => void
	readonly #monotonicNow: LinkMonotonicClock

	/** Pings waiting for a pong, by nonce */
	readonly #pending = new Map<string, PendingPing>()

	/**
	 * @param send - send a ping to a peer over a transport
	 * @param monotonicNow - what round trips are timed by, so that a change to the time of day can't distort them
	 */
	constructor(
		peers: LinkPeerRegistry,
		send: (peerId: string, transportId: string, nonce: string) => void,
		monotonicNow: LinkMonotonicClock
	) {
		this.#peers = peers
		this.#send = send
		this.#monotonicNow = monotonicNow
	}

	/** Ping every compatible peer over every transport it is reachable on, and give up on unanswered pings */
	pingAll(): void {
		const sentNow = this.#monotonicNow()
		for (const [nonce, ping] of this.#pending) {
			if (sentNow - ping.sentAt > LINK_PING_TIMEOUT_MS) this.#pending.delete(nonce)
		}

		for (const peer of this.#peers.getPeers()) {
			if (!peer.compatible) continue
			for (const route of peer.routes) this.ping(peer.id, route.transportId)
		}
	}

	ping(peerId: string, transportId: string): void {
		const nonce = nanoid()
		this.#pending.set(nonce, { peerId, transportId, sentAt: this.#monotonicNow() })
		this.#send(peerId, transportId, nonce)
	}

	/**
	 * A peer answered a ping. Only accepted from the peer, over the transport, that it was sent to
	 * @param peerTime - the peer's clock when it replied
	 * @param now - our clock (the time of day) as the answer arrived, to compare the peer's with
	 */
	handlePong(peerId: string, transportId: string, nonce: string, peerTime: number, now: number): void {
		const ping = this.#pending.get(nonce)
		if (!ping || ping.peerId !== peerId || ping.transportId !== transportId) return

		this.#pending.delete(nonce)
		// Unanswered pings are only given up on with the next round, so check it hasn't been already
		const roundTripMs = this.#monotonicNow() - ping.sentAt
		if (roundTripMs > LINK_PING_TIMEOUT_MS) return

		this.#peers.setLatency(peerId, transportId, roundTripMs)
		// It replied about half way through the round trip
		this.#peers.recordClockSample(peerId, peerTime - (now - roundTripMs / 2), roundTripMs, now)
	}

	clear(): void {
		this.#pending.clear()
	}
}
