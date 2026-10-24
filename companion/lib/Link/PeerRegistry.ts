import { EventEmitter } from 'node:events'
import isEqual from 'fast-deep-equal'
import { z } from 'zod'
import {
	formatLinkIdFingerprint,
	type LinkPeerInfo,
	type LinkPermission,
	type LinkPermissions,
} from '@companion-app/shared/Model/Link.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import LogController from '../Log/Controller.js'
import { LINK_ANNOUNCE_MISSED_LIMIT, LinkAnnouncementSchema, type LinkAnnouncement } from './Protocol/Announcement.js'
import { LINK_CLOCK_ESTIMATE_MAX_AGE_MS } from './Protocol/v1/Timing.js'
import { LINK_PROTOCOL_VERSIONS, negotiateLinkProtocolVersion } from './Protocol/Versions.js'

/** Allowance for timer jitter, when checking whether two measurements of a peer's clock agree */
const CLOCK_AGREEMENT_MARGIN_MS = 20

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
	/** The peer's version of the highest major version both speak, or null if there is none. Set with the announcement */
	protocolVersion: string | null
	/** The name the user has given it here, in place of the one it announces */
	alias: string | null
	/** The transports the peer is reachable on */
	transports: Map<string, PeerTransportRecord>
	lastSeen: number
	/** The lastSeen last saved to the store */
	savedLastSeen: number
	/** What the peer lets us use, once it has said since it became reachable */
	sharedWithUs: LinkPermissions | null
	/** The transport to reach the peer through, while it is reachable (see `getRoute`) */
	route: string | null
	/** How far ahead of ours the peer's clock is, once measured (see `recordClockSample`) */
	clock: { offsetMs: number; roundTripMs: number; measuredAt: number } | null
}

/** A peer seen before, kept so that it is listed after a restart */
const StoredPeerSchema = z.object({
	announcement: LinkAnnouncementSchema,
	lastSeen: z.number(),
	alias: z.string().nullable().default(null),
})
type StoredPeer = z.infer<typeof StoredPeerSchema>

export interface PeerRegistryEvents {
	/** The list of peers, or the reachability of one, changed */
	changed: []
	/** The round trip time to a peer has been measured again, which is only shown */
	latencyChanged: [peerId: string]
	/**
	 * A peer we can talk to has become reachable on a transport: it is newly reachable there, or has just announced a
	 * protocol version in common with us. Nothing is sent to a peer without one
	 */
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

/** How often to save when an online peer was last seen, so it is close enough after an unclean exit */
const LAST_SEEN_SAVE_INTERVAL_MS = 5 * 60_000

/**
 * The installations discovered on any transport, and which transports each is reachable on.
 *
 * Peers stay listed after they go offline, and are remembered across restarts until forgotten, so that their
 * permissions can be changed and buttons linked to them can explain why they are not working.
 */
export class LinkPeerRegistry extends EventEmitter<PeerRegistryEvents> {
	readonly #logger = LogController.createLogger('Link/PeerRegistry')

	readonly #peers = new Map<string, PeerRecord>()
	#selfId: string
	readonly #getSharedByUs: (peerId: string) => LinkPermissions
	readonly #store: DataStoreTableView<Record<string, StoredPeer>>
	#expiryTimer: NodeJS.Timeout | null = null

	/**
	 * @param getSharedByUs - what we let a peer use, as chosen by the user
	 * @param store - the peers seen before, which are listed as offline until they are heard from
	 */
	constructor(
		selfId: string,
		getSharedByUs: (peerId: string) => LinkPermissions,
		store: DataStoreTableView<Record<string, StoredPeer>>
	) {
		super()
		this.setMaxListeners(0)
		this.#selfId = selfId
		this.#getSharedByUs = getSharedByUs
		this.#store = store

		for (const [peerId, raw] of Object.entries(store.all())) {
			const stored = StoredPeerSchema.safeParse(raw)
			if (!stored.success || peerId === selfId || !this.#isRemembered(peerId, stored.data.alias)) {
				store.delete(peerId)
				continue
			}
			this.#peers.set(peerId, {
				id: peerId,
				announcement: stored.data.announcement,
				protocolVersion: negotiateWith(stored.data.announcement),
				alias: stored.data.alias,
				transports: new Map(),
				lastSeen: stored.data.lastSeen,
				savedLastSeen: stored.data.lastSeen,
				sharedWithUs: null,
				route: null,
				clock: null,
			})
		}
	}

	start(): void {
		this.#expiryTimer ??= setInterval(() => this.expireStale(Date.now()), EXPIRY_CHECK_INTERVAL_MS)
	}

	stop(): void {
		if (this.#expiryTimer) clearInterval(this.#expiryTimer)
		this.#expiryTimer = null

		// lastSeen is only saved when something else changes, so save it for those still online
		for (const record of this.#peers.values()) {
			if (record.transports.size > 0) this.#save(record)
		}
	}

	setSelfId(selfId: string): void {
		this.#selfId = selfId
		this.#store.delete(selfId)
		if (this.#peers.delete(selfId)) this.emit('changed')
	}

	/**
	 * Whether a peer is remembered across restarts: once it is shared something, or given a name here. Any other peer
	 * is found again when it is reachable, so isn't worth keeping
	 */
	#isRemembered(peerId: string, alias: string | null): boolean {
		return alias !== null || Object.values(this.#getSharedByUs(peerId)).some(Boolean)
	}

	#save(record: PeerRecord): void {
		record.savedLastSeen = record.lastSeen
		if (this.#isRemembered(record.id, record.alias)) {
			this.#store.set(record.id, { announcement: record.announcement, lastSeen: record.lastSeen, alias: record.alias })
		} else {
			this.#store.delete(record.id)
		}
	}

	/** What we share with a peer has changed, which decides whether it is remembered */
	sharedByUsChanged(peerId: string): void {
		const record = this.#peers.get(peerId)
		if (record) this.#save(record)
	}

	/** Process an announcement received on a transport */
	handleAnnouncement(transportId: string, peerId: string, announcement: LinkAnnouncement, now: number): void {
		if (peerId === this.#selfId) return

		let record = this.#peers.get(peerId)
		// Saved when it changes or comes back online, and every so often while it stays online, rather than for every
		// announcement
		const needsSave =
			!record ||
			record.transports.size === 0 ||
			!isEqual(record.announcement, announcement) ||
			now - record.savedLastSeen >= LAST_SEEN_SAVE_INTERVAL_MS
		const isNew = !record
		if (!record) {
			this.#logger.info(`Discovered ${announcement.name} (${peerId})`)
			record = {
				id: peerId,
				announcement,
				protocolVersion: negotiateWith(announcement),
				alias: null,
				transports: new Map(),
				lastSeen: now,
				savedLastSeen: now,
				sharedWithUs: null,
				route: null,
				clock: null,
			}
			this.#peers.set(peerId, record)
		}

		const existing = record.transports.get(transportId)
		const wasCompatible = !!existing && record.protocolVersion !== null
		// Most announcements are a repeat, which changes nothing that is shown: only when it was last seen, which is shown
		// once it goes offline (and so changes then)
		const changed = isNew || !existing || !isEqual(record.announcement, announcement)
		if (!isEqual(record.announcement, announcement)) {
			record.announcement = announcement
			record.protocolVersion = negotiateWith(announcement)
		}
		record.transports.set(transportId, { lastSeen: now, latencyMs: existing?.latencyMs ?? null })
		record.lastSeen = now
		if (needsSave) this.#save(record)

		if (changed) this.emit('changed')
		if (!wasCompatible && record.protocolVersion !== null) this.emit('peerReachable', peerId, transportId)
		if (!record.route) {
			record.route = transportId
			this.emit('routeChanged', peerId, transportId)
		}
	}

	/** A peer told us what it lets us use */
	handleAccess(peerId: string, permissions: LinkPermissions): void {
		const record = this.#peers.get(peerId)
		if (!record || record.transports.size === 0) return
		// Repeated every so often, in case one was lost
		if (isEqual(record.sharedWithUs, permissions)) return

		record.sharedWithUs = permissions
		this.emit('changed')
		this.emit('sharedWithUsChanged', peerId)
	}

	/** Record the round trip time to a peer over a transport */
	setLatency(peerId: string, transportId: string, latencyMs: number): void {
		const entry = this.#peers.get(peerId)?.transports.get(transportId)
		if (!entry) return

		entry.latencyMs = latencyMs
		this.emit('latencyChanged', peerId)
	}

	/** Whether messages can be exchanged with a peer: it has a protocol version in common with us */
	isCompatible(peerId: string): boolean {
		return (this.#peers.get(peerId)?.protocolVersion ?? null) !== null
	}

	/** What a peer lets us use, or null until it has said (or it isn't known) */
	getSharedWithUs(peerId: string): LinkPermissions | null {
		return this.#peers.get(peerId)?.sharedWithUs ?? null
	}

	/** The last measured round trip time to a peer over its route, or null */
	getRouteLatency(peerId: string): number | null {
		const record = this.#peers.get(peerId)
		if (!record?.route) return null
		return record.transports.get(record.route)?.latencyMs ?? null
	}

	/**
	 * Record a measurement of how far ahead of ours a peer's clock is. A measurement is accurate to within half its
	 * round trip, so the one from the fastest round trip is kept, until it is too old to trust. Or until a measurement
	 * can't agree with it, which means a clock has been changed (eg set by NTP once a device without a clock battery
	 * has booted)
	 */
	recordClockSample(peerId: string, offsetMs: number, roundTripMs: number, now: number): void {
		const record = this.#peers.get(peerId)
		if (!record) return

		const current = record.clock
		if (
			current &&
			current.roundTripMs < roundTripMs &&
			now - current.measuredAt < LINK_CLOCK_ESTIMATE_MAX_AGE_MS &&
			Math.abs(offsetMs - current.offsetMs) <= (current.roundTripMs + roundTripMs) / 2 + CLOCK_AGREEMENT_MARGIN_MS
		)
			return
		record.clock = { offsetMs, roundTripMs, measuredAt: now }
	}

	/** How far ahead of ours a peer's clock is, or null if that hasn't been measured */
	getClockOffset(peerId: string): number | null {
		return this.#peers.get(peerId)?.clock?.offsetMs ?? null
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
			this.#save(record)
			// It says again when it is next reachable, and may have restarted with its clock changed
			record.sharedWithUs = null
			record.clock = null
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

	/** Call a peer something else here than the name it announces, or null to use that again */
	setAlias(peerId: string, alias: string | null): void {
		const record = this.#peers.get(peerId)
		if (!record) return

		record.alias = alias?.trim() || null
		this.#save(record)
		this.emit('changed')
	}

	/** Forget a peer, so that it is no longer listed. It will be rediscovered if it is still announcing */
	forget(peerId: string): void {
		const record = this.#peers.get(peerId)
		if (!record) return

		this.#peers.delete(peerId)
		this.#store.delete(peerId)
		this.emit('changed')
		if (record.route) this.emit('routeChanged', peerId, null)
		this.emit('peerUnreachable', peerId)
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
	const { protocolVersion } = record
	return {
		id: record.id,
		fingerprint: formatLinkIdFingerprint(record.id),
		name: record.alias ?? announcement.name,
		announcedName: announcement.name,
		alias: record.alias,
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

/** Whether a peer announces a protocol version in common with us, so that we can talk to it */
function negotiateWith(announcement: LinkAnnouncement): string | null {
	return negotiateLinkProtocolVersion(LINK_PROTOCOL_VERSIONS, announcement.protocolVersions)
}
