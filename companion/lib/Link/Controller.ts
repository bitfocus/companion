import { EventEmitter } from 'node:events'
import os from 'node:os'
import { nanoid } from 'nanoid'
import z from 'zod'
import type { ClientLinkTransportType, LinkPeerInfo, LinkSelfInfo } from '@companion-app/shared/Model/Link.js'
import { JsonObjectSchema } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import LogController from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { LinkPeerRegistry } from './PeerRegistry.js'
import { decodeLinkMessage, encodeLinkMessage } from './Protocol/Schemas.js'
import {
	LINK_ANNOUNCE_INTERVAL_MS,
	LINK_DISCOVERY_WILDCARD,
	linkDiscoveryTopic,
	linkInboxTopic,
	parseLinkDiscoveryTopic,
} from './Protocol/Topics.js'
import { LINK_PROTOCOL_VERSION } from './Protocol/Versions.js'
import { LinkTransportManager } from './TransportManager.js'
import type { LinkMessageOrigin, SomeLinkTransportDefinition } from './Transports/Types.js'

interface LinkControllerEvents {
	self: [info: LinkSelfInfo]
	peers: [peers: LinkPeerInfo[]]
}

/**
 * Companion Link: linking Companion installations together, so that one can show and press the buttons of
 * another. See Transports/README.md for an overview of how the pieces fit together.
 */
export class LinkController {
	readonly #logger = LogController.createLogger('Link/Controller')

	readonly #appInfo: AppInfo
	readonly #userconfig: DataUserConfig
	readonly #pageStore: IPageStore
	readonly #table: DataStoreTableView<{ id: string }>

	readonly #events = new EventEmitter<LinkControllerEvents>()

	readonly #transports: LinkTransportManager
	readonly #peers: LinkPeerRegistry

	#started = false
	#selfId: string
	#announceTimer: NodeJS.Timeout | null = null
	#subscribedInbox: string | null = null

	readonly #transportDefinitions: readonly SomeLinkTransportDefinition[]

	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		userconfig: DataUserConfig,
		pageStore: IPageStore,
		transportDefinitions: readonly SomeLinkTransportDefinition[]
	) {
		this.#appInfo = appInfo
		this.#userconfig = userconfig
		this.#pageStore = pageStore
		this.#table = db.getTableView('link')
		this.#transportDefinitions = transportDefinitions
		this.#events.setMaxListeners(0)

		this.#selfId = this.#table.getPrimitiveOrDefault('id', nanoid())

		this.#transports = new LinkTransportManager(
			db,
			transportDefinitions,
			() => this.#selfId,
			() => this.#getSelfInfo().name,
			() => ({ topic: linkDiscoveryTopic(this.#selfId), payload: '', retain: true })
		)
		this.#peers = new LinkPeerRegistry(this.#selfId)

		this.#transports.events.on('message', (transportId, topic, payload, origin) =>
			this.#handleMessage(transportId, topic, payload, origin)
		)
		this.#transports.events.on('permissionsChanged', (transportId, connectionId, permissions) => {
			for (const peerId of this.#peers.updateConnectionPermissions(transportId, connectionId, permissions)) {
				this.#sendAccess(peerId, transportId)
			}
		})
		this.#transports.events.on('transportConnected', (transportId) => this.#announce(transportId))
		this.#transports.events.on('transportDisconnected', (transportId) =>
			this.#peers.handleTransportDisconnected(transportId)
		)
		this.#peers.on('changed', () => this.#events.emit('peers', this.#peers.getPeers()))
		this.#peers.on('peerReachable', (peerId, transportId) => this.#sendAccess(peerId, transportId))

		this.#pageStore.on('pagecount', () => this.#announce(null))
		this.#userconfig.on('keyChanged', (key) => {
			if (key === 'installName') {
				this.#events.emit('self', this.#getSelfInfo())
				this.#announce(null)
			} else if (key === 'gridSize') {
				this.#announce(null)
			}
		})
	}

	/** Start linking. Called once the rest of Companion is ready */
	start(): void {
		this.#started = true

		this.#transports.subscribe(LINK_DISCOVERY_WILDCARD)
		this.#subscribeInbox()

		this.#peers.start()
		this.#transports.start()

		this.#announceTimer = setInterval(() => this.#announce(null), LINK_ANNOUNCE_INTERVAL_MS)
	}

	/** Say goodbye to peers and stop all transports */
	async stop(): Promise<void> {
		if (this.#announceTimer) clearInterval(this.#announceTimer)
		this.#announceTimer = null

		this.#peers.stop()

		await this.#transports.stopAll()
	}

	#subscribeInbox(): void {
		const inbox = linkInboxTopic(this.#selfId)
		if (this.#subscribedInbox === inbox) return

		if (this.#subscribedInbox) this.#transports.unsubscribe(this.#subscribedInbox)
		this.#subscribedInbox = inbox
		this.#transports.subscribe(inbox)
	}

	#getSelfInfo(): LinkSelfInfo {
		const installName = String(this.#userconfig.getKey('installName') || '').trim()
		return {
			id: this.#selfId,
			name: installName || os.hostname(),
			protocolVersion: LINK_PROTOCOL_VERSION,
		}
	}

	/**
	 * Publish our announcement
	 * @param transportId - the transport to publish on, or null for all of them
	 */
	#announce(transportId: string | null): void {
		const self = this.#getSelfInfo()
		const grid = this.#userconfig.getKey('gridSize')

		const payload = encodeLinkMessage('announcement', {
			id: self.id,
			name: self.name,
			companionVersion: this.#appInfo.appVersion,
			protocolVersion: self.protocolVersion,
			pageCount: this.#pageStore.getPageCount(),
			grid: { minRow: grid.minRow, maxRow: grid.maxRow, minColumn: grid.minColumn, maxColumn: grid.maxColumn },
			announceIntervalMs: LINK_ANNOUNCE_INTERVAL_MS,
		})

		const topic = linkDiscoveryTopic(self.id)
		if (transportId) {
			this.#transports.publishTo(transportId, topic, payload, { retain: true, requires: null })
		} else {
			this.#transports.publishAll(topic, payload, { retain: true, requires: null })
		}
	}

	/** Tell a peer what it may use of this installation over a transport */
	#sendAccess(peerId: string, transportId: string): void {
		const permissions = this.#peers.getSharedByUs(peerId, transportId)
		if (!permissions) return

		this.#transports.publishTo(
			transportId,
			linkInboxTopic(peerId),
			encodeLinkMessage('access', { sourceId: this.#selfId, permissions }),
			{ retain: false, requires: null }
		)
	}

	#handleMessage(transportId: string, topic: string, raw: string, origin: LinkMessageOrigin): void {
		const discoveryPeerId = parseLinkDiscoveryTopic(topic)
		if (discoveryPeerId !== null && raw === '') {
			this.#peers.handleGoodbye(transportId, discoveryPeerId)
			return
		}

		const decoded = decodeLinkMessage(raw)
		if (!decoded.ok) {
			this.#logger.debug(`Ignoring invalid message on ${topic}: ${decoded.error}`)
			return
		}

		const message = decoded.message
		const isForUs = topic === linkInboxTopic(this.#selfId)
		switch (message.type) {
			case 'announcement':
				// The announcement must be on the topic of the peer it describes
				if (discoveryPeerId === message.payload.id) {
					this.#peers.handleAnnouncement(transportId, message.payload, origin, Date.now())
				}
				break
			case 'access':
				if (isForUs) this.#peers.handleAccess(transportId, message.payload.sourceId, message.payload.permissions)
				break
			default:
				// Button messages are not handled yet
				this.#logger.debug(`Unhandled message type on ${topic}`)
				break
		}
	}

	async #regenerateId(): Promise<void> {
		// Say goodbye as the old id. Peers expire the subscriptions held for it, and we subscribe again under the
		// new id once they are rediscovered
		await this.#transports.stopAll()

		this.#selfId = nanoid()
		this.#table.setPrimitive('id', this.#selfId)
		this.#peers.setSelfId(this.#selfId)

		if (this.#started) {
			this.#subscribeInbox()
			this.#transports.start()
		}

		this.#events.emit('self', this.#getSelfInfo())
	}

	createTrpcRouter() {
		const self = this
		return router({
			transportTypes: publicProcedure.query((): ClientLinkTransportType[] =>
				self.#transportDefinitions.map((def) => ({
					type: def.type,
					name: def.name,
					description: def.description,
					configFields: def.configFields,
				}))
			),

			watchSelf: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'self', signal)
				yield self.#getSelfInfo()
				for await (const [info] of changes) yield info
			}),

			watchPeers: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#events, 'peers', signal)
				yield self.#peers.getPeers()
				for await (const [peers] of changes) yield peers
			}),

			watchTransports: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#transports.events, 'configs', signal)
				yield { type: 'init', items: self.#transports.getConfigs() } as const
				for await (const [update] of changes) yield update
			}),

			watchTransportStates: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#transports.events, 'states', signal)
				yield { type: 'init', items: self.#transports.getStates() } as const
				for await (const [update] of changes) yield update
			}),

			addTransport: publicProcedure
				.input(z.object({ type: z.string(), label: z.string().trim().min(1).max(100) }))
				.mutation(({ input }) => this.#transports.add(input.type, input.label)),

			updateTransport: publicProcedure
				.input(z.object({ id: z.string(), label: z.string().trim().min(1).max(100), config: JsonObjectSchema }))
				.mutation(async ({ input }) => this.#transports.update(input.id, input.label, input.config)),

			setTransportEnabled: publicProcedure
				.input(z.object({ id: z.string(), enabled: z.boolean() }))
				.mutation(async ({ input }) => this.#transports.setEnabled(input.id, input.enabled)),

			transportAction: publicProcedure
				.input(
					z.object({
						transportId: z.string(),
						entryId: z.string(),
						actionId: z.string(),
						input: z.string().max(1000).nullable(),
					})
				)
				.mutation(async ({ input }) =>
					this.#transports.handleAction(input.transportId, input.entryId, input.actionId, input.input)
				),

			removeTransport: publicProcedure
				.input(z.object({ id: z.string() }))
				.mutation(async ({ input }) => this.#transports.remove(input.id)),

			forgetPeer: publicProcedure
				.input(z.object({ peerId: z.string() }))
				.mutation(({ input }) => this.#peers.forget(input.peerId)),

			regenerateId: publicProcedure.mutation(async () => {
				await this.#regenerateId().catch((e) => {
					this.#logger.error(`Failed to regenerate id: ${stringifyError(e)}`)
					throw e
				})
			}),
		})
	}
}
