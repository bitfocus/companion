import { nanoid } from 'nanoid'
import type { LinkPeerRegistry } from './PeerRegistry.js'
import { LINK_PING_TIMEOUT_MS } from './Protocol/v1/Topics.js'

interface PendingPing {
	peerId: string
	transportId: string
	sentAt: number
}

/**
 * Measures the round trip time to each peer over each transport it is reachable on, with ping messages. The result
 * is recorded in the peer registry, for the UI.
 */
export class LinkPinger {
	readonly #peers: LinkPeerRegistry
	readonly #send: (peerId: string, transportId: string, nonce: string) => void

	/** Pings waiting for a pong, by nonce */
	readonly #pending = new Map<string, PendingPing>()

	/**
	 * @param send - send a ping to a peer over a transport
	 */
	constructor(peers: LinkPeerRegistry, send: (peerId: string, transportId: string, nonce: string) => void) {
		this.#peers = peers
		this.#send = send
	}

	/** Ping every compatible peer over every transport it is reachable on, and give up on unanswered pings */
	pingAll(now: number): void {
		for (const [nonce, ping] of this.#pending) {
			if (now - ping.sentAt > LINK_PING_TIMEOUT_MS) this.#pending.delete(nonce)
		}

		for (const peer of this.#peers.getPeers()) {
			if (!peer.compatible) continue
			for (const route of peer.routes) this.ping(peer.id, route.transportId, now)
		}
	}

	ping(peerId: string, transportId: string, now: number): void {
		const nonce = nanoid()
		this.#pending.set(nonce, { peerId, transportId, sentAt: now })
		this.#send(peerId, transportId, nonce)
	}

	/** A peer answered a ping. Only accepted from the peer, over the transport, that it was sent to */
	handlePong(peerId: string, transportId: string, nonce: string, now: number): void {
		const ping = this.#pending.get(nonce)
		if (!ping || ping.peerId !== peerId || ping.transportId !== transportId) return

		this.#pending.delete(nonce)
		this.#peers.setLatency(peerId, transportId, now - ping.sentAt)
	}

	clear(): void {
		this.#pending.clear()
	}
}
