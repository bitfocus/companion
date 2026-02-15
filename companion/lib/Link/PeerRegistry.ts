import EventEmitter from 'node:events'
import LogController from '../Log/Controller.js'
import type { LinkPeerInfo } from '@companion-app/shared/Model/Link.js'
import type { AnnouncementPayload } from './Protocol.js'

/** Internal per-transport peer data */
interface PeerTransportEntry {
	/** Last seen timestamp from this transport */
	lastSeen: number
	/** Whether considered online on this transport */
	online: boolean
}

/** Internal peer record */
interface PeerRecord {
	/** Core peer info from announcement */
	info: Omit<LinkPeerInfo, 'online' | 'transports' | 'lastSeen'>
	/** Per-transport reachability state */
	transports: Map<string, PeerTransportEntry>
}

export type PeerRegistryEvents = {
	/** Emitted whenever the peers list changes */
	peersChanged: [peers: LinkPeerInfo[]]
}

/**
 * Tracks discovered peers across all transports.
 * Aggregates per-transport reachability into a unified peer list.
 */
export class PeerRegistry extends EventEmitter<PeerRegistryEvents> {
	readonly #logger = LogController.createLogger('Link/PeerRegistry')

	/** Map of peer UUID → PeerRecord */
	readonly #peers = new Map<string, PeerRecord>()

	/** Our own UUID, so we don't track ourselves */
	#selfUuid: string

	/** Offline timeout in ms (2× announcement interval) */
	readonly #offlineTimeout: number

	/** Interval handle for checking stale peers */
	#checkInterval: ReturnType<typeof setInterval> | null = null

	constructor(selfUuid: string, offlineTimeoutMs = 120_000) {
		super()
		this.setMaxListeners(0)
		this.#selfUuid = selfUuid
		this.#offlineTimeout = offlineTimeoutMs
	}

	/** Start the periodic stale-check timer */
	start(): void {
		this.stop()
		this.#checkInterval = setInterval(() => this.#checkStalePeers(), 30_000)
	}

	/** Stop the periodic stale-check timer */
	stop(): void {
		if (this.#checkInterval) {
			clearInterval(this.#checkInterval)
			this.#checkInterval = null
		}
	}

	/** Update our own UUID (e.g., after regeneration) */
	setSelfUuid(uuid: string): void {
		this.#selfUuid = uuid
		// Remove ourselves if we were somehow tracked
		if (this.#peers.delete(uuid)) {
			this.#emitPeers()
		}
	}

	/**
	 * Process an announcement from a peer on a specific transport.
	 * @param transportId - The transport instance ID the announcement arrived on
	 * @param announcement - The announcement payload
	 */
	handleAnnouncement(transportId: string, announcement: AnnouncementPayload): void {
		if (announcement.id === this.#selfUuid) return

		let record = this.#peers.get(announcement.id)
		if (!record) {
			record = {
				info: {
					id: announcement.id,
					name: announcement.name,
					version: announcement.version,
					protocolVersion: announcement.protocolVersion,
					pageCount: announcement.pageCount,
					gridSize: announcement.gridSize,
				},
				transports: new Map(),
			}
			this.#peers.set(announcement.id, record)
			this.#logger.info(`Discovered new peer: ${announcement.name} (${announcement.id})`)
		}

		// Update peer info (may have changed)
		record.info.name = announcement.name
		record.info.version = announcement.version
		record.info.protocolVersion = announcement.protocolVersion
		record.info.pageCount = announcement.pageCount
		record.info.gridSize = announcement.gridSize

		// Update transport entry
		record.transports.set(transportId, {
			lastSeen: Date.now(),
			online: true,
		})

		this.#emitPeers()
	}

	/**
	 * Handle a peer going offline on a specific transport.
	 * Called when an empty retained message is received (graceful offline).
	 */
	handlePeerOffline(transportId: string, peerId: string): void {
		const record = this.#peers.get(peerId)
		if (!record) return

		const entry = record.transports.get(transportId)
		if (entry) {
			entry.online = false
		}

		this.#emitPeers()
	}

	/**
	 * Remove all peer entries associated with a transport instance.
	 * Called when a transport is removed or disconnects.
	 */
	removeTransport(transportId: string): void {
		for (const record of this.#peers.values()) {
			record.transports.delete(transportId)
		}
		this.#emitPeers()
	}

	/**
	 * Delete a peer entirely (user action from UI).
	 */
	deletePeer(peerId: string): boolean {
		const deleted = this.#peers.delete(peerId)
		if (deleted) {
			this.#emitPeers()
		}
		return deleted
	}

	/** Get the current list of peers for the UI */
	getPeers(): LinkPeerInfo[] {
		return this.#buildPeerList()
	}

	/** Check for peers that haven't been seen recently and mark them offline */
	#checkStalePeers(): void {
		const now = Date.now()
		let changed = false

		for (const record of this.#peers.values()) {
			for (const [, entry] of record.transports) {
				if (entry.online && now - entry.lastSeen > this.#offlineTimeout) {
					entry.online = false
					changed = true
				}
			}
		}

		if (changed) {
			this.#emitPeers()
		}
	}

	/** Build the flat peer list from internal records */
	#buildPeerList(): LinkPeerInfo[] {
		const peers: LinkPeerInfo[] = []

		for (const record of this.#peers.values()) {
			const onlineTransports: string[] = []
			let latestSeen = 0

			for (const [transportId, entry] of record.transports) {
				if (entry.online) {
					onlineTransports.push(transportId)
				}
				if (entry.lastSeen > latestSeen) {
					latestSeen = entry.lastSeen
				}
			}

			peers.push({
				...record.info,
				online: onlineTransports.length > 0,
				transports: onlineTransports,
				lastSeen: latestSeen,
			})
		}

		return peers
	}

	#emitPeers(): void {
		this.emit('peersChanged', this.#buildPeerList())
	}
}
