import { EventEmitter } from 'node:events'
import type { LinkPeerInfo, LinkPermission, LinkPermissions } from '@companion-app/shared/Model/Link.js'
import LogController from '../Log/Controller.js'
import { formatLinkIdFingerprint } from './Identity.js'
import { LINK_ANNOUNCE_MISSED_LIMIT, type LinkAnnouncement } from './Protocol/Announcement.js'
import { LINK_PROTOCOL_VERSIONS, negotiateLinkProtocolVersion } from './Protocol/Versions.js'

/** How a peer is reachable on one transport */
interface PeerTransportRecord {
	/** When the peer was last heard from on this transport */
	lastSeen: number
	/** The last measured round trip time over this transport, once one has been */
	latencyMs: number | null
}

interface PeerRecord {
	id: string
	announcement: LinkAnnouncement
	/** The transports the peer is reachable on */
	transports: Map<string, PeerTransportRecord>
	lastSeen: number
	/** What the peer lets us use, once it has said since it became reachable */
	sharedWithUs: LinkPermissions | null
	/** The transport to reach the peer through, while it is reachable (see `getRoute`) */
	route: string | null
}

export interface PeerRegistryEvents {
	/** The list of peers, or the reachability of one, changed */
	changed: []
	/** A peer has become reachable on a transport */
	peerReachable: [peerId: string, transportId: string]
	/** A peer is no longer reachable on any transport */
	peerUnreachable: [peerId: string]
	/** What a peer lets us use has changed */
	sharedWithUsChanged: [peerId: string]
	/** The transport to reach a peer through has changed, or it can no longer be reached (null) */
	routeChanged: [peerId: string, transportId: string | null]
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
	readonly #getSharedByUs: (peerId: string) => LinkPermissions
	#expiryTimer: NodeJS.Timeout | null = null

	/**
	 * @param getSharedByUs - what we let a peer use, as chosen by the user
	 */
	constructor(selfId: string, getSharedByUs: (peerId: string) => LinkPermissions) {
		super()
		this.setMaxListeners(0)
		this.#selfId = selfId
		this.#getSharedByUs = getSharedByUs
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
	handleAnnouncement(transportId: string, peerId: string, announcement: LinkAnnouncement, now: number): void {
		if (peerId === this.#selfId) return

		let record = this.#peers.get(peerId)
		if (!record) {
			this.#logger.info(`Discovered ${announcement.name} (${peerId})`)
			record = { id: peerId, announcement, transports: new Map(), lastSeen: now, sharedWithUs: null, route: null }
			this.#peers.set(peerId, record)
		}

		const existing = record.transports.get(transportId)
		record.announcement = announcement
		record.transports.set(transportId, { lastSeen: now, latencyMs: existing?.latencyMs ?? null })
		record.lastSeen = now

		this.emit('changed')
		if (!existing) this.emit('peerReachable', peerId, transportId)
		if (!record.route) {
			record.route = transportId
			this.emit('routeChanged', peerId, transportId)
		}
	}

	/** A peer told us what it lets us use */
	handleAccess(peerId: string, permissions: LinkPermissions): void {
		const record = this.#peers.get(peerId)
		if (!record || record.transports.size === 0) return

		record.sharedWithUs = permissions
		this.emit('changed')
		this.emit('sharedWithUsChanged', peerId)
	}

	/** Record the round trip time to a peer over a transport */
	setLatency(peerId: string, transportId: string, latencyMs: number): void {
		const entry = this.#peers.get(peerId)?.transports.get(transportId)
		if (!entry) return

		entry.latencyMs = latencyMs
		this.emit('changed')
	}

	/** A peer said it is going offline on a transport */
	handleGoodbye(transportId: string, peerId: string): void {
		const record = this.#peers.get(peerId)
		if (record?.transports.delete(transportId)) this.#emitChanged([record])
	}

	/** A transport has stopped, so nothing is reachable through it any more */
	handleTransportDisconnected(transportId: string): void {
		const changed: PeerRecord[] = []
		for (const record of this.#peers.values()) {
			if (record.transports.delete(transportId)) changed.push(record)
		}
		this.#emitChanged(changed)
	}

	/** Mark peers unreachable on transports they have stopped announcing on */
	expireStale(now: number): void {
		const changed: PeerRecord[] = []
		for (const record of this.#peers.values()) {
			const timeout = record.announcement.announceIntervalMs * LINK_ANNOUNCE_MISSED_LIMIT
			for (const [transportId, { lastSeen }] of record.transports) {
				if (now - lastSeen > timeout) {
					record.transports.delete(transportId)
					if (!changed.includes(record)) changed.push(record)
				}
			}
		}
		this.#emitChanged(changed)
	}

	/** Emit the change, and that peers which can no longer be reached on any transport are gone */
	#emitChanged(changedRecords: PeerRecord[]): void {
		if (changedRecords.length === 0) return
		this.emit('changed')
		for (const record of changedRecords) {
			if (record.route && !record.transports.has(record.route)) {
				record.route = chooseRoute(record)
				this.emit('routeChanged', record.id, record.route)
			}

			if (record.transports.size > 0) continue
			// It says again when it is next reachable
			record.sharedWithUs = null
			this.emit('peerUnreachable', record.id)
		}
	}

	/**
	 * The transport to reach a peer through, or null if it is unreachable. It stays the same while that transport
	 * reaches the peer, so that everything about a peer goes one way, and only changes when it stops doing so
	 */
	getRoute(peerId: string): string | null {
		return this.#peers.get(peerId)?.route ?? null
	}

	/** Forget a peer. It will be rediscovered if it is still announcing */
	forget(peerId: string): void {
		const record = this.#peers.get(peerId)
		if (!record) return

		this.#peers.delete(peerId)
		this.emit('changed')
		if (record.route) this.emit('routeChanged', peerId, null)
		this.emit('peerUnreachable', peerId)
	}

	clear(): void {
		this.#peers.clear()
		this.emit('changed')
	}

	/**
	 * The transports a peer can currently be reached on, most recently heard from first
	 * @param requires - none if the peer has said it denies us this, or null for any use
	 */
	getReachableTransports(peerId: string, requires: LinkPermission | null): string[] {
		const record = this.#peers.get(peerId)
		if (!record) return []
		if (requires && record.sharedWithUs?.[requires] === false) return []
		return Array.from(record.transports.entries())
			.sort((a, b) => b[1].lastSeen - a[1].lastSeen)
			.map(([id]) => id)
	}

	getPeer(peerId: string): LinkPeerInfo | undefined {
		const record = this.#peers.get(peerId)
		return record ? toPeerInfo(record, this.#getSharedByUs(record.id)) : undefined
	}

	getPeers(): LinkPeerInfo[] {
		return Array.from(this.#peers.values(), (record) => toPeerInfo(record, this.#getSharedByUs(record.id)))
	}
}

function toPeerInfo(record: PeerRecord, sharedByUs: LinkPermissions): LinkPeerInfo {
	const { announcement } = record
	const protocolVersion = negotiateLinkProtocolVersion(LINK_PROTOCOL_VERSIONS, announcement.protocolVersions)
	return {
		id: record.id,
		fingerprint: formatLinkIdFingerprint(record.id),
		name: announcement.name,
		companionVersion: announcement.companionVersion,
		protocolVersions: announcement.protocolVersions,
		protocolVersion,
		compatible: protocolVersion !== null,
		routes: Array.from(record.transports, ([transportId, { latencyMs }]) => ({ transportId, latencyMs })),
		online: record.transports.size > 0,
		lastSeen: record.lastSeen,
		sharedByUs,
		sharedWithUs: record.sharedWithUs,
	}
}

/** Choose a new route to a peer: the transport with the lowest measured round trip, else the most recently heard */
function chooseRoute(record: PeerRecord): string | null {
	let best: [string, PeerTransportRecord] | null = null
	for (const entry of record.transports) {
		if (!best) {
			best = entry
			continue
		}
		const [, a] = entry
		const [, b] = best
		if (a.latencyMs !== null && (b.latencyMs === null || a.latencyMs < b.latencyMs)) best = entry
		else if (a.latencyMs === b.latencyMs && a.lastSeen > b.lastSeen) best = entry
	}
	return best?.[0] ?? null
}
