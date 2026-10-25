import { EventEmitter } from 'node:events'
import isEqual from 'fast-deep-equal'
import { z } from 'zod'
import {
	formatLinkIdFingerprint,
	LINK_NO_PERMISSIONS,
	type LinkPeerInfo,
	type LinkPermission,
	type LinkPermissions,
} from '@companion-app/shared/Model/Link.js'
import type { DataStoreTableView } from '../Data/Tables/TableView.js'
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
	/** The instance ids it has announced with, newest first: the last two, to see it flip between two */
	instanceIds: string[]
	/** Whether it has flipped back to the instance id before, since it last announced a new one */
	flippedBack: boolean
	/** When it was last seen announcing with two instance ids at once, so is more than one installation */
	sharesLinkIdSeenAt: number | null
	/** The transports the peer is reachable on */
	transports: Map<string, PeerTransportRecord>
	lastSeen: number
	/** The lastSeen last saved to the store */
	savedLastSeen: number
	/** What we let the peer use, as chosen by the user */
	sharedByUs: LinkPermissions
	/** What the peer lets us use, once it has said since it became reachable */
	sharedWithUs: LinkPermissions | null
	/** Whether it has shared something with us, kept once it has */
	hasSharedWithUs: boolean
	/** The transport to reach the peer through, while it is reachable (see `getRoute`) */
	route: string | null
	/** How far ahead of ours the peer's clock is, once measured (see `recordClockSample`) */
	clock: { offsetMs: number; roundTripMs: number; measuredAt: number } | null
}

/** Kinds of things added later default to not shared, and one that can't be read shares nothing */
const StoredPermissionsSchema = z
	.object({ buttons: z.boolean().default(false) })
	.catch(() => ({ ...LINK_NO_PERMISSIONS }))

/** A peer seen before, kept so that it is listed after a restart, with what we share with it */
const StoredPeerSchema = z.object({
	announcement: LinkAnnouncementSchema,
	lastSeen: z.number(),
	alias: z.string().nullable().default(null),
	sharedByUs: StoredPermissionsSchema,
	hasSharedWithUs: z.boolean().default(false),
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
	/** What a peer lets us use has changed */
	sharedWithUsChanged: [peerId: string]
	/** What we let a peer use has changed */
	sharedByUsChanged: [peerId: string, permissions: LinkPermissions]
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
 * Peers stay listed after they go offline, and those worth keeping (see `isRemembered`) are remembered across
 * restarts until forgotten, so that their permissions can be changed and buttons linked to them can explain why they
 * are not working. What the user shares with a peer is kept with it, so is forgotten with it.
 */
export class LinkPeerRegistry extends EventEmitter<PeerRegistryEvents> {
	readonly #logger = LogController.createLogger('Link/PeerRegistry')

	readonly #peers = new Map<string, PeerRecord>()
	#selfId: string
	readonly #store: DataStoreTableView<Record<string, StoredPeer>>
	#expiryTimer: NodeJS.Timeout | null = null

	/**
	 * @param store - the peers seen before, which are listed as offline until they are heard from
	 */
	constructor(selfId: string, store: DataStoreTableView<Record<string, StoredPeer>>) {
		super()
		this.setMaxListeners(0)
		this.#selfId = selfId
		this.#store = store

		for (const [peerId, raw] of Object.entries(store.all())) {
			const stored = StoredPeerSchema.safeParse(raw)
			// Kept, with what is shared with it, for a version that can read it
			if (!stored.success) continue
			if (peerId === selfId || !isRemembered(stored.data)) {
				store.delete(peerId)
				continue
			}
			this.#peers.set(peerId, {
				id: peerId,
				announcement: stored.data.announcement,
				protocolVersion: negotiateWith(stored.data.announcement),
				alias: stored.data.alias,
				instanceIds: [],
				flippedBack: false,
				sharesLinkIdSeenAt: null,
				transports: new Map(),
				lastSeen: stored.data.lastSeen,
				savedLastSeen: stored.data.lastSeen,
				sharedByUs: stored.data.sharedByUs,
				sharedWithUs: null,
				hasSharedWithUs: stored.data.hasSharedWithUs,
				route: null,
				clock: null,
			})
		}
	}

	start(): void {
		this.#expiryTimer ??= setInterval(() => this.expireStale(performance.now()), EXPIRY_CHECK_INTERVAL_MS)
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

	#save(record: PeerRecord): void {
		record.savedLastSeen = record.lastSeen
		if (isRemembered(record)) {
			this.#store.set(record.id, {
				announcement: record.announcement,
				lastSeen: record.lastSeen,
				alias: record.alias,
				sharedByUs: record.sharedByUs,
				hasSharedWithUs: record.hasSharedWithUs,
			})
		} else {
			this.#store.delete(record.id)
		}
	}

	/** What we let a peer use, as chosen by the user. Nothing, for one that isn't listed */
	getSharedByUs(peerId: string): LinkPermissions {
		return { ...(this.#peers.get(peerId)?.sharedByUs ?? LINK_NO_PERMISSIONS) }
	}

	/** Choose what we let a listed peer use */
	setSharedByUs(peerId: string, permissions: LinkPermissions): void {
		const record = this.#peers.get(peerId)
		if (!record || isEqual(record.sharedByUs, permissions)) return

		record.sharedByUs = { ...permissions }
		this.#save(record)
		this.emit('changed')
		this.emit('sharedByUsChanged', peerId, { ...permissions })
	}

	/**
	 * Process an announcement received on a transport
	 * @param now - from the monotonic clock, as expiry must not jump with the wall clock (eg set by NTP at boot)
	 */
	handleAnnouncement(transportId: string, peerId: string, announcement: LinkAnnouncement, now: number): void {
		if (peerId === this.#selfId) return
		// Shown and stored, so from the wall clock
		const seenAt = Date.now()

		let record = this.#peers.get(peerId)
		// Saved when it changes or comes back online, and every so often while it stays online, rather than for every
		// announcement
		const needsSave =
			!record ||
			record.transports.size === 0 ||
			!isSameAnnouncement(record.announcement, announcement) ||
			seenAt - record.savedLastSeen >= LAST_SEEN_SAVE_INTERVAL_MS
		const isNew = !record
		if (!record) {
			this.#logger.info(`Discovered ${announcement.name} (${peerId})`)
			record = {
				id: peerId,
				announcement,
				protocolVersion: negotiateWith(announcement),
				alias: null,
				instanceIds: [],
				flippedBack: false,
				sharesLinkIdSeenAt: null,
				transports: new Map(),
				lastSeen: seenAt,
				savedLastSeen: seenAt,
				sharedByUs: { ...LINK_NO_PERMISSIONS },
				sharedWithUs: null,
				hasSharedWithUs: false,
				route: null,
				clock: null,
			}
			this.#peers.set(peerId, record)
		}

		const existing = record.transports.get(transportId)
		const wasCompatible = !!existing && record.protocolVersion !== null
		// Most announcements are a repeat, which changes nothing that is shown: only when it was last seen, which is shown
		// once it goes offline (and so changes then)
		let changed = isNew || !existing || !isSameAnnouncement(record.announcement, announcement)

		// Restarting changes the instance id once. Flipping back to the one before means two are announcing
		const { instanceId } = announcement
		if (instanceId && instanceId !== record.instanceIds[0]) {
			if (instanceId === record.instanceIds[1] && !record.flippedBack) {
				// Once could be a stale announcement from before a restart. Not made the newest, as then the next from the
				// newest would flip back too
				record.flippedBack = true
			} else {
				if (instanceId === record.instanceIds[1]) {
					if (record.sharesLinkIdSeenAt === null) changed = true
					record.sharesLinkIdSeenAt = now
				} else {
					record.flippedBack = false
				}
				record.instanceIds = [instanceId, ...record.instanceIds].slice(0, 2)
			}
		}
		if (!isEqual(record.announcement, announcement)) {
			record.announcement = announcement
			record.protocolVersion = negotiateWith(announcement)
		}
		record.transports.set(transportId, { lastSeen: now, latencyMs: existing?.latencyMs ?? null })
		record.lastSeen = seenAt
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
		// Checked on every repeat too, as it is cleared when the peer is forgotten while online
		if (!record.hasSharedWithUs && Object.values(permissions).some(Boolean)) {
			record.hasSharedWithUs = true
			this.#save(record)
		}
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

	/** Whether messages can be exchanged with a peer: it is reachable, and has a protocol version in common with us */
	isCompatible(peerId: string): boolean {
		const record = this.#peers.get(peerId)
		return !!record && record.transports.size > 0 && record.protocolVersion !== null
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

	/** How far ahead of ours a peer's clock is, or null if that hasn't been measured lately */
	getClockOffset(peerId: string): number | null {
		const clock = this.#peers.get(peerId)?.clock
		// Measured by the time of day, as it is compared with the peer's
		if (!clock || Date.now() - clock.measuredAt >= LINK_CLOCK_ESTIMATE_MAX_AGE_MS) return null
		return clock.offsetMs
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

	/**
	 * Mark peers unreachable on transports they have stopped announcing on
	 * @param now - from the monotonic clock, as for `handleAnnouncement`
	 */
	expireStale(now: number): void {
		const changed: PeerRecord[] = []
		let sharingCleared = false
		for (const record of this.#peers.values()) {
			const timeout = record.announcement.announceIntervalMs * LINK_ANNOUNCE_MISSED_LIMIT
			// No longer seen flipping between two, eg one was given a new Link id
			if (record.sharesLinkIdSeenAt !== null && now - record.sharesLinkIdSeenAt > timeout) {
				record.sharesLinkIdSeenAt = null
				sharingCleared = true
			}
			for (const [transportId, { lastSeen }] of record.transports) {
				if (now - lastSeen > timeout) {
					record.transports.delete(transportId)
					if (!changed.includes(record)) changed.push(record)
				}
			}
		}
		if (changed.length > 0) this.#emitChanged(changed)
		else if (sharingCleared) this.emit('changed')
	}

	/** Emit the change, and that peers which can no longer be reached on any transport are gone */
	#emitChanged(changedRecords: PeerRecord[]): void {
		if (changedRecords.length === 0) return
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
		}
		this.emit('changed')
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

	/**
	 * Forget a peer, so that it is no longer listed and nothing is shared with it. It will be rediscovered if it is still
	 * announcing. One that is reachable stays listed until a restart, unnamed and not remembered, so that what it sends
	 * is still read
	 */
	forget(peerId: string): void {
		const record = this.#peers.get(peerId)
		if (!record) return

		// First, so that it is told it no longer has access while it can still be reached
		this.setSharedByUs(peerId, LINK_NO_PERMISSIONS)

		if (record.transports.size > 0) {
			record.alias = null
			record.hasSharedWithUs = false
			this.#store.delete(peerId)
			this.emit('changed')
			return
		}

		this.#peers.delete(peerId)
		this.#store.delete(peerId)
		this.emit('changed')
		if (record.route) this.emit('routeChanged', peerId, null)
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
		return record ? toPeerInfo(record) : undefined
	}

	getPeers(): LinkPeerInfo[] {
		return Array.from(this.#peers.values(), toPeerInfo)
	}
}

/**
 * Whether a peer is remembered across restarts: once it is shared something, has shared something with us, or is
 * given a name here. Any other peer is found again when it is reachable, so isn't worth keeping
 */
function isRemembered(peer: Pick<StoredPeer, 'alias' | 'sharedByUs' | 'hasSharedWithUs'>): boolean {
	return peer.alias !== null || peer.hasSharedWithUs || Object.values(peer.sharedByUs).some(Boolean)
}

function toPeerInfo(record: PeerRecord): LinkPeerInfo {
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
		sharedByUs: { ...record.sharedByUs },
		sharedWithUs: record.sharedWithUs,
		sharesLinkId: record.sharesLinkIdSeenAt !== null,
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

/** Whether two announcements are the same, other than the instance id, which two clones alternate between */
function isSameAnnouncement(a: LinkAnnouncement, b: LinkAnnouncement): boolean {
	return isEqual({ ...a, instanceId: undefined }, { ...b, instanceId: undefined })
}

/** Whether a peer announces a protocol version in common with us, so that we can talk to it */
function negotiateWith(announcement: LinkAnnouncement): string | null {
	return negotiateLinkProtocolVersion(LINK_PROTOCOL_VERSIONS, announcement.protocolVersions)
}
