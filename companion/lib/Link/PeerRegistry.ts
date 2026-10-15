import { EventEmitter } from 'node:events'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import LogController from '../Log/Controller.js'
import type { LinkAnnouncementPayload } from './Protocol/Schemas.js'
import { LINK_ANNOUNCE_MISSED_LIMIT } from './Protocol/Topics.js'
import { isLinkProtocolCompatible } from './Protocol/Versions.js'

interface PeerRecord {
	announcement: LinkAnnouncementPayload
	/** When the peer was last heard from, on each transport it is reachable on */
	transports: Map<string, number>
	lastSeen: number
}

export interface PeerRegistryEvents {
	/** The list of peers, or the reachability of one, changed */
	changed: []
	/** A peer has become reachable on a transport */
	peerReachable: [peerId: string, transportId: string]
}

/** How often to look for peers that have stopped announcing */
const EXPIRY_CHECK_INTERVAL_MS = 5_000

/**
 * The installations discovered on any transport, and which transports each is reachable on.
 *
 * Peers stay listed after they go offline (for the session), so that buttons linked to them can explain why they
 * are not working.
 */
export class LinkPeerRegistry extends EventEmitter<PeerRegistryEvents> {
	readonly #logger = LogController.createLogger('Link/PeerRegistry')

	readonly #peers = new Map<string, PeerRecord>()
	#selfId: string
	#expiryTimer: NodeJS.Timeout | null = null

	constructor(selfId: string) {
		super()
		this.setMaxListeners(0)
		this.#selfId = selfId
	}

	start(): void {
		this.#expiryTimer ??= setInterval(() => this.expireStale(Date.now()), EXPIRY_CHECK_INTERVAL_MS)
	}

	stop(): void {
		if (this.#expiryTimer) clearInterval(this.#expiryTimer)
		this.#expiryTimer = null
	}

	setSelfId(selfId: string): void {
		this.#selfId = selfId
		if (this.#peers.delete(selfId)) this.emit('changed')
	}

	/** Process an announcement received on a transport */
	handleAnnouncement(transportId: string, announcement: LinkAnnouncementPayload, now: number): void {
		if (announcement.id === this.#selfId) return

		let record = this.#peers.get(announcement.id)
		if (!record) {
			this.#logger.info(`Discovered ${announcement.name} (${announcement.id})`)
			record = { announcement, transports: new Map(), lastSeen: now }
			this.#peers.set(announcement.id, record)
		}

		const wasReachable = record.transports.has(transportId)
		record.announcement = announcement
		record.transports.set(transportId, now)
		record.lastSeen = now

		this.emit('changed')
		if (!wasReachable) this.emit('peerReachable', announcement.id, transportId)
	}

	/** A peer said it is going offline on a transport */
	handleGoodbye(transportId: string, peerId: string): void {
		const record = this.#peers.get(peerId)
		if (record?.transports.delete(transportId)) this.emit('changed')
	}

	/** A transport has stopped, so nothing is reachable through it any more */
	handleTransportDisconnected(transportId: string): void {
		let changed = false
		for (const record of this.#peers.values()) {
			if (record.transports.delete(transportId)) changed = true
		}
		if (changed) this.emit('changed')
	}

	/** Mark peers unreachable on transports they have stopped announcing on */
	expireStale(now: number): void {
		let changed = false
		for (const record of this.#peers.values()) {
			const timeout = record.announcement.announceIntervalMs * LINK_ANNOUNCE_MISSED_LIMIT
			for (const [transportId, lastSeen] of record.transports) {
				if (now - lastSeen > timeout) {
					record.transports.delete(transportId)
					changed = true
				}
			}
		}
		if (changed) this.emit('changed')
	}

	/** Forget a peer. It will be rediscovered if it is still announcing */
	forget(peerId: string): void {
		if (this.#peers.delete(peerId)) this.emit('changed')
	}

	clear(): void {
		this.#peers.clear()
		this.emit('changed')
	}

	/** The transports a peer can currently be reached on, most recently heard from first */
	getReachableTransports(peerId: string): string[] {
		const record = this.#peers.get(peerId)
		if (!record) return []
		return Array.from(record.transports.entries())
			.sort((a, b) => b[1] - a[1])
			.map(([id]) => id)
	}

	getPeer(peerId: string): LinkPeerInfo | undefined {
		const record = this.#peers.get(peerId)
		return record ? toPeerInfo(record) : undefined
	}

	getPeers(): LinkPeerInfo[] {
		return Array.from(this.#peers.values(), toPeerInfo)
	}
}

function toPeerInfo(record: PeerRecord): LinkPeerInfo {
	const { announcement } = record
	return {
		id: announcement.id,
		name: announcement.name,
		companionVersion: announcement.companionVersion,
		protocolVersion: announcement.protocolVersion,
		compatible: isLinkProtocolCompatible(announcement.protocolVersion),
		pageCount: announcement.pageCount,
		grid: announcement.grid,
		transportIds: Array.from(record.transports.keys()),
		online: record.transports.size > 0,
		lastSeen: record.lastSeen,
	}
}
