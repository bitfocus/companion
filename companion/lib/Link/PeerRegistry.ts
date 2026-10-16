import { EventEmitter } from 'node:events'
import type { LinkPeerInfo, LinkPermission, LinkPermissions } from '@companion-app/shared/Model/Link.js'
import LogController from '../Log/Controller.js'
import type { LinkAnnouncementPayload } from './Protocol/Schemas.js'
import { LINK_ANNOUNCE_MISSED_LIMIT } from './Protocol/Topics.js'
import { isLinkProtocolCompatible } from './Protocol/Versions.js'
import type { LinkMessageOrigin } from './Transports/Types.js'

/** How a peer is reachable on one transport */
interface PeerTransportRecord {
	/** When the peer was last heard from on this transport */
	lastSeen: number
	/** The connection of the transport the peer is on, eg its pairing */
	connectionId: string
	/** What we let the peer use over this transport, decided by the transport */
	sharedByUs: LinkPermissions
	/** What the peer lets us use over this transport, once it has said */
	sharedWithUs: LinkPermissions | null
}

interface PeerRecord {
	announcement: LinkAnnouncementPayload
	/** The transports the peer is reachable on */
	transports: Map<string, PeerTransportRecord>
	lastSeen: number
}

export interface PeerRegistryEvents {
	/** The list of peers, or the reachability of one, changed */
	changed: []
	/** A peer has become reachable on a transport */
	peerReachable: [peerId: string, transportId: string]
	/** A peer is no longer reachable on any transport */
	peerUnreachable: [peerId: string]
	/** What a peer lets us use over a transport has changed */
	sharedWithUsChanged: [peerId: string, transportId: string]
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
	handleAnnouncement(
		transportId: string,
		announcement: LinkAnnouncementPayload,
		origin: LinkMessageOrigin,
		now: number
	): void {
		if (announcement.id === this.#selfId) return

		let record = this.#peers.get(announcement.id)
		if (!record) {
			this.#logger.info(`Discovered ${announcement.name} (${announcement.id})`)
			record = { announcement, transports: new Map(), lastSeen: now }
			this.#peers.set(announcement.id, record)
		}

		const existing = record.transports.get(transportId)
		const wasReachable = !!existing
		record.announcement = announcement
		record.transports.set(transportId, {
			lastSeen: now,
			connectionId: origin.connectionId,
			sharedByUs: origin.permissions,
			// Kept while it stays reachable, as it is only sent when that starts or it changes
			sharedWithUs: existing?.sharedWithUs ?? null,
		})
		record.lastSeen = now

		this.emit('changed')
		if (!wasReachable) this.emit('peerReachable', announcement.id, transportId)
	}

	/** A peer told us what it lets us use over a transport */
	handleAccess(transportId: string, peerId: string, permissions: LinkPermissions): void {
		const entry = this.#peers.get(peerId)?.transports.get(transportId)
		if (!entry) return

		entry.sharedWithUs = permissions
		this.emit('changed')
		this.emit('sharedWithUsChanged', peerId, transportId)
	}

	/**
	 * What we let a connection of a transport use has changed
	 * @returns the peers on that connection
	 */
	updateConnectionPermissions(transportId: string, connectionId: string, permissions: LinkPermissions): string[] {
		const peerIds: string[] = []
		for (const record of this.#peers.values()) {
			const entry = record.transports.get(transportId)
			if (entry?.connectionId !== connectionId) continue
			entry.sharedByUs = permissions
			peerIds.push(record.announcement.id)
		}
		if (peerIds.length > 0) this.emit('changed')
		return peerIds
	}

	/** What we let a peer use over a transport */
	getSharedByUs(peerId: string, transportId: string): LinkPermissions | undefined {
		return this.#peers.get(peerId)?.transports.get(transportId)?.sharedByUs
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
			if (record.transports.size === 0) this.emit('peerUnreachable', record.announcement.id)
		}
	}

	/** Forget a peer. It will be rediscovered if it is still announcing */
	forget(peerId: string): void {
		if (this.#peers.delete(peerId)) {
			this.emit('changed')
			this.emit('peerUnreachable', peerId)
		}
	}

	clear(): void {
		this.#peers.clear()
		this.emit('changed')
	}

	/**
	 * The transports a peer can currently be reached on, most recently heard from first
	 * @param requires - only transports the peer hasn't said it denies us this on, or null for any
	 */
	getReachableTransports(peerId: string, requires: LinkPermission | null): string[] {
		const record = this.#peers.get(peerId)
		if (!record) return []
		return Array.from(record.transports.entries())
			.filter(([, entry]) => !requires || entry.sharedWithUs?.[requires] !== false)
			.sort((a, b) => b[1].lastSeen - a[1].lastSeen)
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
	const knownSharedWithUs = Array.from(record.transports.values(), (t) => t.sharedWithUs).filter((p) => p !== null)
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
		sharedByUs: combinePermissions(Array.from(record.transports.values(), (t) => t.sharedByUs)),
		sharedWithUs: knownSharedWithUs.length > 0 ? combinePermissions(knownSharedWithUs) : null,
	}
}

/** Something is shared if it is shared over any transport */
function combinePermissions(permissions: LinkPermissions[]): LinkPermissions {
	return { buttons: permissions.some((p) => p.buttons) }
}
