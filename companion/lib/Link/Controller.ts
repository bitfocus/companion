import { EventEmitter } from 'node:events'
import os from 'node:os'
import z from 'zod'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type {
	ClientLinkTransportType,
	LinkPeerInfo,
	LinkPeerUsage,
	LinkPermission,
	LinkSelfInfo,
} from '@companion-app/shared/Model/Link.js'
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
import { LinkIdentity } from './Identity.js'
import { LinkPeerRegistry } from './PeerRegistry.js'
import { LinkPermissionStore } from './PermissionStore.js'
import { LinkPinger } from './Pinger.js'
import {
	decodeLinkAnnouncement,
	encodeLinkAnnouncement,
	LINK_ANNOUNCE_INTERVAL_MS,
	LINK_DISCOVERY_WILDCARD,
	linkDiscoveryTopic,
	parseLinkDiscoveryTopic,
} from './Protocol/Announcement.js'
import { decodeLinkMessage, encodeLinkMessage } from './Protocol/v1/Schemas.js'
import { linkInboxTopic, linkPeerTopicPrefix } from './Protocol/v1/Topics.js'
import { LINK_PROTOCOL_VERSIONS } from './Protocol/Versions.js'
import { LinkTransportManager } from './TransportManager.js'
import type { LinkMessageOrigin, SomeLinkTransportDefinition } from './Transports/Types.js'

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
	readonly #table: DataStoreTableView<{ identity: string }>

	readonly #events = new EventEmitter<LinkControllerEvents>()

	readonly #transports: LinkTransportManager
	readonly #peers: LinkPeerRegistry
	readonly #pinger: LinkPinger
	readonly #permissions: LinkPermissionStore
	readonly #buttonServer: LinkButtonServer
	/** Used by link buttons to subscribe to remote buttons */
	readonly buttonClient: LinkButtonClient

	#host: LinkHost | null = null
	#identity: LinkIdentity
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

		this.#identity = this.#loadIdentity()
		this.#selfId = this.#identity.id

		this.#permissions = new LinkPermissionStore(db)
		this.#transports = new LinkTransportManager(
			db,
			transportDefinitions,
			() => this.#identity,
			() => this.#getSelfInfo().name,
			(peerId) => this.#permissions.get(peerId),
			() => ({ topic: linkDiscoveryTopic(this.#selfId), payload: '', retain: true })
		)
		this.#peers = new LinkPeerRegistry(this.#selfId, (peerId) => this.#permissions.get(peerId))
		this.#pinger = new LinkPinger(this.#peers, (peerId, transportId, nonce) =>
			this.#transports.publishTo(transportId, linkInboxTopic(peerId), encodeLinkMessage('ping', { nonce }), {
				retain: false,
				requires: null,
			})
		)
		this.buttonClient = new LinkButtonClient(() => this.#selfId, this.#peers, {
			publishTo: (transportId, topic, payload) =>
				this.#transports.publishTo(transportId, topic, payload, { retain: false, requires: null }),
			subscribeOn: (transportId, pattern) => this.#transports.subscribeOn(transportId, pattern),
			unsubscribeFrom: (transportId, pattern) => this.#transports.unsubscribeFrom(transportId, pattern),
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
				// Only to those allowed to see our buttons
				publish: (transportId, topic, payload) =>
					this.#transports.publishTo(transportId, topic, payload, { retain: false, requires: 'buttons' }),
			},
			() => this.#selfId
		)

		this.#transports.events.on('message', (transportId, topic, payload, origin) =>
			this.#handleMessage(transportId, topic, payload, origin)
		)
		this.#permissions.on('changed', (peerId, permissions) => {
			this.#events.emit('peers', this.#peers.getPeers())
			for (const transportId of this.#peers.getReachableTransports(peerId, null)) this.#sendAccess(peerId, transportId)
			// Stop serving anything it is no longer allowed straight away, rather than when its lease runs out
			if (!permissions.buttons) this.#buttonServer.revoke(peerId)
		})
		this.#transports.events.on('transportConnected', (transportId) => this.#announce(transportId))
		this.#transports.events.on('transportDisconnected', (transportId) =>
			this.#peers.handleTransportDisconnected(transportId)
		)
		this.#peers.on('changed', () => this.#events.emit('peers', this.#peers.getPeers()))
		this.#peers.on('peerUnreachable', (peerId) => this.#buttonServer.releaseHeldBy(peerId))
		this.#peers.on('peerReachable', (peerId, transportId) => {
			this.#sendAccess(peerId, transportId)
			this.#pinger.ping(peerId, transportId, Date.now())
		})

		this.#userconfig.on('keyChanged', (key) => {
			if (key === 'installName') {
				this.#events.emit('self', this.#getSelfInfo())
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
			this.#pinger.pingAll(Date.now())
			this.#buttonServer.expireLeases(Date.now())
		}, LINK_ANNOUNCE_INTERVAL_MS)
	}

	/** Say goodbye to peers and stop all transports */
	async stop(): Promise<void> {
		if (this.#announceTimer) clearInterval(this.#announceTimer)
		this.#announceTimer = null
		this.#pinger.clear()

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
			protocolVersions: [...LINK_PROTOCOL_VERSIONS],
		}
	}

	/**
	 * Publish our announcement
	 * @param transportId - the transport to publish on, or null for all of them
	 */
	#announce(transportId: string | null): void {
		const self = this.#getSelfInfo()

		const payload = encodeLinkAnnouncement({
			name: self.name,
			companionVersion: this.#appInfo.appVersion,
			protocolVersions: self.protocolVersions,
			announceIntervalMs: LINK_ANNOUNCE_INTERVAL_MS,
		})

		const topic = linkDiscoveryTopic(self.id)
		if (transportId) {
			this.#transports.publishTo(transportId, topic, payload, { retain: true, requires: null })
		} else {
			this.#transports.publishAll(topic, payload, { retain: true, requires: null })
		}
	}

	#getSourceChain(location: ControlLocation): string[] {
		const controlId = this.#pageStore.getControlIdAt(location)
		return (controlId && this.buttonClient.getState(controlId)?.sourceChain) || []
	}

	/** Tell a peer what it may use of this installation, over a transport it is reachable on */
	#sendAccess(peerId: string, transportId: string): void {
		const permissions = this.#permissions.get(peerId)
		this.#transports.publishTo(transportId, linkInboxTopic(peerId), encodeLinkMessage('access', { permissions }), {
			retain: false,
			requires: null,
		})
	}

	#handleMessage(transportId: string, topic: string, raw: string, origin: LinkMessageOrigin): void {
		const discoveryPeerId = parseLinkDiscoveryTopic(topic)
		if (discoveryPeerId !== null && raw === '') {
			// A broker may not be able to say who cleared the topic, but anyone else saying it is a spoof
			if (origin.peerId === null || origin.peerId === discoveryPeerId) {
				this.#peers.handleGoodbye(transportId, discoveryPeerId)
			}
			return
		}

		// Who sent it is decided by the transport, not the message
		const senderId = origin.peerId
		if (senderId === null) {
			this.#logger.debug(`Ignoring a message on ${topic}, the transport can't say who sent it`)
			return
		}

		if (discoveryPeerId !== null) {
			const decoded = decodeLinkAnnouncement(raw)
			if (!decoded.ok) {
				this.#logger.debug(`Ignoring invalid announcement on ${topic}: ${decoded.error}`)
			} else if (discoveryPeerId === senderId) {
				// The announcement must be on the topic of the peer that sent it
				this.#peers.handleAnnouncement(transportId, senderId, decoded.announcement, Date.now())
			}
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
			case 'access':
				if (isForUs) this.#peers.handleAccess(senderId, message.payload.permissions)
				break
			case 'ping':
				// Answered over the transport it came on, so that the round trip is measured over it
				if (isForUs) {
					this.#transports.publishTo(
						transportId,
						linkInboxTopic(senderId),
						encodeLinkMessage('pong', message.payload),
						{
							retain: false,
							requires: null,
						}
					)
				}
				break
			case 'pong':
				if (isForUs) this.#pinger.handlePong(senderId, transportId, message.payload.nonce, Date.now())
				break
			case 'subscribe':
				if (isForUs && this.#isAllowed(senderId, 'buttons', topic)) {
					this.#buttonServer.handleSubscribe(senderId, transportId, message.payload, Date.now())
				}
				break
			case 'unsubscribe':
				if (isForUs) this.#buttonServer.handleUnsubscribe(senderId, message.payload)
				break
			case 'button.press':
				if (isForUs && this.#isAllowed(senderId, 'buttons', topic)) {
					this.#buttonServer.handlePress(senderId, message.payload)
				}
				break
			case 'button.rotate':
				if (isForUs && this.#isAllowed(senderId, 'buttons', topic)) {
					this.#buttonServer.handleRotate(senderId, message.payload)
				}
				break
			case 'button.update':
				// Updates are published on the topics of the peer that owns the button
				if (topic.startsWith(linkPeerTopicPrefix(senderId))) this.buttonClient.handleUpdate(topic, message.payload)
				break
			default:
				this.#logger.debug(`Unhandled message type on ${topic}`)
				break
		}
	}

	/** Whether the installation a message came from may use something, as chosen by the user */
	#isAllowed(peerId: string, permission: LinkPermission, topic: string): boolean {
		if (this.#permissions.get(peerId)[permission]) return true
		this.#logger.debug(`Ignoring a request on ${topic}, ${peerId} is not allowed ${permission}`)
		return false
	}

	/** The identity of this installation, generated the first time */
	#loadIdentity(): LinkIdentity {
		const stored = LinkIdentity.fromStored(this.#table.getPrimitiveOrDefault('identity', ''))
		if (stored) return stored

		const identity = LinkIdentity.generate()
		this.#table.setPrimitive('identity', identity.toStored())
		return identity
	}

	async #regenerateId(): Promise<void> {
		// Say goodbye as the old id. Peers expire the subscriptions held for it, and we subscribe again under the
		// new id once they are rediscovered
		await this.#transports.stopAll()

		this.#identity = LinkIdentity.generate()
		this.#table.setPrimitive('identity', this.#identity.toStored())
		this.#selfId = this.#identity.id
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

			transportSectionAction: publicProcedure
				.input(
					z.object({
						transportId: z.string(),
						entryId: z.string(),
						actionId: z.string(),
						input: z.string().max(1000).nullable(),
					})
				)
				.mutation(async ({ input }) =>
					this.#transports.handleSectionAction(input.transportId, input.entryId, input.actionId, input.input)
				),

			removeTransport: publicProcedure
				.input(z.object({ id: z.string() }))
				.mutation(async ({ input }) => this.#transports.remove(input.id)),

			peerUsage: publicProcedure.input(z.object({ peerId: z.string() })).query(({ input }): LinkPeerUsage => ({
				buttons: {
					oursUsedThere: this.#buttonServer.countSubscribedBy(input.peerId),
					theirsUsedHere: this.buttonClient.countSubscribedTo(input.peerId),
				},
			})),

			forgetPeer: publicProcedure
				.input(z.object({ peerId: z.string() }))
				.mutation(({ input }) => this.#peers.forget(input.peerId)),

			setPeerPermissions: publicProcedure
				.input(z.object({ peerId: z.string(), permissions: z.object({ buttons: z.boolean() }) }))
				.mutation(({ input }) => this.#permissions.set(input.peerId, input.permissions)),

			regenerateId: publicProcedure.mutation(async () => {
				await this.#regenerateId().catch((e) => {
					this.#logger.error(`Failed to regenerate id: ${stringifyError(e)}`)
					throw e
				})
			}),
		})
	}
}
