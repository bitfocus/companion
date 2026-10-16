import { EventEmitter } from 'node:events'
import os from 'node:os'
import { nanoid } from 'nanoid'
import z from 'zod'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ClientLinkTransportType, LinkPeerInfo, LinkSelfInfo } from '@companion-app/shared/Model/Link.js'
import { JsonObjectSchema } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import LogController from '../Log/Controller.js'
import type { IPageStore } from '../Page/Store.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { LinkButtonClient } from './ButtonClient.js'
import { LinkButtonServer, type LinkButtonServerHost } from './ButtonServer.js'
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
import { LINK_TRANSPORT_DEFINITIONS } from './Transports/index.js'

/** What Link needs from the rest of Companion to serve buttons to peers */
export type LinkHost = Omit<LinkButtonServerHost, 'publish' | 'getSourceChain'>

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
	readonly #buttonServer: LinkButtonServer
	/** Used by link buttons to subscribe to remote buttons */
	readonly buttonClient: LinkButtonClient

	#host: LinkHost | null = null
	#selfId: string
	#announceTimer: NodeJS.Timeout | null = null
	#subscribedInbox: string | null = null

	constructor(appInfo: AppInfo, db: DataDatabase, userconfig: DataUserConfig, pageStore: IPageStore) {
		this.#appInfo = appInfo
		this.#userconfig = userconfig
		this.#pageStore = pageStore
		this.#table = db.getTableView('link')
		this.#events.setMaxListeners(0)

		this.#selfId = this.#table.getPrimitiveOrDefault('id', nanoid())

		this.#transports = new LinkTransportManager(
			db,
			LINK_TRANSPORT_DEFINITIONS,
			() => this.#selfId,
			() => this.#getSelfInfo().name,
			() => ({ topic: linkDiscoveryTopic(this.#selfId), payload: '', retain: true })
		)
		this.#peers = new LinkPeerRegistry(this.#selfId)
		this.buttonClient = new LinkButtonClient(() => this.#selfId, this.#peers, {
			publishTo: (transportId, topic, payload) =>
				this.#transports.publishTo(transportId, topic, payload, { retain: false }),
			subscribe: (pattern) => this.#transports.subscribe(pattern),
			unsubscribe: (pattern) => this.#transports.unsubscribe(pattern),
		})
		this.#buttonServer = new LinkButtonServer(
			{
				getCachedRenderOrGeneratePlaceholder: (location) =>
					this.#requireHost().getCachedRenderOrGeneratePlaceholder(location),
				getControlIdAt: (location) => this.#requireHost().getControlIdAt(location),
				pressControl: (controlId, pressed, surfaceId) =>
					this.#requireHost().pressControl(controlId, pressed, surfaceId),
				rotateControl: (controlId, delta, surfaceId) => this.#requireHost().rotateControl(controlId, delta, surfaceId),
				getSourceChain: (location) => this.#getSourceChain(location),
				publish: (topic, payload) => this.#transports.publishAll(topic, payload, { retain: false }),
			},
			() => this.#selfId
		)

		this.#transports.events.on('message', (transportId, topic, payload) =>
			this.#handleMessage(transportId, topic, payload)
		)
		this.#transports.events.on('transportConnected', (transportId) => this.#announce(transportId))
		this.#transports.events.on('transportDisconnected', (transportId) =>
			this.#peers.handleTransportDisconnected(transportId)
		)
		this.#peers.on('changed', () => this.#events.emit('peers', this.#peers.getPeers()))
		this.#peers.on('peerUnreachable', (peerId) => this.#buttonServer.releaseHeldBy(peerId))

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

	/** Start linking. Called once the rest of Companion is ready to serve buttons */
	start(host: LinkHost): void {
		this.#host = host

		this.#transports.subscribe(LINK_DISCOVERY_WILDCARD)
		this.#subscribeInbox()

		this.#peers.start()
		this.buttonClient.start()
		this.#transports.start()

		this.#announceTimer = setInterval(() => {
			this.#announce(null)
			this.#buttonServer.expireLeases(Date.now())
		}, LINK_ANNOUNCE_INTERVAL_MS)
	}

	/** Say goodbye to peers and stop all transports */
	async stop(): Promise<void> {
		if (this.#announceTimer) clearInterval(this.#announceTimer)
		this.#announceTimer = null

		this.buttonClient.stop()
		this.#peers.stop()
		this.#buttonServer.clear()

		await this.#transports.stopAll()
	}

	onButtonDrawn(location: ControlLocation, render: ImageResult): void {
		this.#buttonServer.onButtonDrawn(location, render)
	}

	#requireHost(): LinkHost {
		if (!this.#host) throw new Error('Link has not been started')
		return this.#host
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
			this.#transports.publishTo(transportId, topic, payload, { retain: true })
		} else {
			this.#transports.publishAll(topic, payload, { retain: true })
		}
	}

	#getSourceChain(location: ControlLocation): string[] {
		const controlId = this.#pageStore.getControlIdAt(location)
		return (controlId && this.buttonClient.getState(controlId)?.sourceChain) || []
	}

	#handleMessage(transportId: string, topic: string, raw: string): void {
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
					this.#peers.handleAnnouncement(transportId, message.payload, Date.now())
				}
				break
			case 'subscribe':
				if (isForUs) this.#buttonServer.handleSubscribe(message.payload, Date.now())
				break
			case 'unsubscribe':
				if (isForUs) this.#buttonServer.handleUnsubscribe(message.payload)
				break
			case 'button.press':
				if (isForUs) this.#buttonServer.handlePress(message.payload)
				break
			case 'button.rotate':
				if (isForUs) this.#buttonServer.handleRotate(message.payload)
				break
			case 'button.update':
				this.buttonClient.handleUpdate(topic, message.payload)
				break
			default:
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
		this.#buttonServer.clear()

		if (this.#host) {
			this.#subscribeInbox()
			this.#transports.start()
		}

		this.#events.emit('self', this.#getSelfInfo())
	}

	createTrpcRouter() {
		const self = this
		return router({
			transportTypes: publicProcedure.query((): ClientLinkTransportType[] =>
				LINK_TRANSPORT_DEFINITIONS.map((def) => ({
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
