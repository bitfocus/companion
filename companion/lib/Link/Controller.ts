import { EventEmitter } from 'node:events'
import os from 'node:os'
import isEqual from 'fast-deep-equal'
import z from 'zod'
import type { ClientLinkTransportType, LinkPeerInfo, LinkSelfInfo } from '@companion-app/shared/Model/Link.js'
import { JsonObjectSchema } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { formatLinkIdFingerprint, LinkIdentity } from './Identity.js'
import { LinkPeerRegistry } from './PeerRegistry.js'
import { LinkPermissionStore } from './PermissionStore.js'
import { LinkPinger } from './Pinger.js'
import { decodeLinkAnnouncement, encodeLinkAnnouncement, LINK_ANNOUNCE_INTERVAL_MS } from './Protocol/Announcement.js'
import { decodeLinkMessage, encodeLinkMessage } from './Protocol/v1/Schemas.js'
import { LINK_PROTOCOL_VERSIONS } from './Protocol/Versions.js'
import { LinkTransportManager } from './TransportManager.js'
import type { LinkMessageOrigin, SomeLinkBuiltinTransport, SomeLinkTransportDefinition } from './Transports/Types.js'

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
	readonly #table: DataStoreTableView<{ identity: string }>

	readonly #events = new EventEmitter<LinkControllerEvents>()

	readonly #transports: LinkTransportManager
	readonly #peers: LinkPeerRegistry
	readonly #pinger: LinkPinger
	readonly #permissions: LinkPermissionStore

	#started = false
	#identity: LinkIdentity
	#selfId: string
	#announceTimer: NodeJS.Timeout | null = null
	/** The id regeneration in progress, which the next one waits for, so that they don't interleave */
	#regenerating: Promise<void> = Promise.resolve()

	readonly #transportDefinitions: readonly SomeLinkTransportDefinition[]
	readonly #builtinTransports: readonly SomeLinkBuiltinTransport[]

	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		userconfig: DataUserConfig,
		transportDefinitions: readonly SomeLinkTransportDefinition[],
		builtinTransports: readonly SomeLinkBuiltinTransport[]
	) {
		this.#appInfo = appInfo
		this.#userconfig = userconfig
		this.#table = db.getTableView('link')
		this.#transportDefinitions = transportDefinitions
		this.#builtinTransports = builtinTransports
		this.#events.setMaxListeners(0)

		this.#identity = this.#loadIdentity()
		this.#selfId = this.#identity.id

		this.#permissions = new LinkPermissionStore(db)
		this.#transports = new LinkTransportManager(
			db,
			[...transportDefinitions, ...builtinTransports.map((builtin) => builtin.definition)],
			() => this.#identity,
			() => this.#getSelfInfo().name
		)
		this.#peers = new LinkPeerRegistry(this.#selfId, (peerId) => this.#permissions.get(peerId))
		this.#pinger = new LinkPinger(this.#peers, (peerId, transportId, nonce) =>
			this.#transports.sendTo(transportId, peerId, encodeLinkMessage('ping', { nonce }))
		)

		this.#transports.events.on('announcement', (transportId, peerId, payload) =>
			this.#handleAnnouncement(transportId, peerId, payload)
		)
		this.#transports.events.on('message', (transportId, payload, origin) =>
			this.#handleMessage(transportId, payload, origin)
		)
		this.#permissions.on('changed', (peerId) => {
			this.#events.emit('peers', this.#peers.getPeers())
			for (const transportId of this.#peers.getReachableTransports(peerId, null)) this.#sendAccess(peerId, transportId)
		})
		this.#transports.events.on('transportConnected', (transportId) => this.#announce(transportId))
		this.#transports.events.on('transportDisconnected', (transportId) =>
			this.#peers.handleTransportDisconnected(transportId)
		)
		this.#peers.on('changed', () => this.#events.emit('peers', this.#peers.getPeers()))
		this.#peers.on('peerReachable', (peerId, transportId) => {
			this.#sendAccess(peerId, transportId)
			this.#pinger.ping(peerId, transportId, Date.now())
		})

		for (const builtin of builtinTransports) this.#applyBuiltin(builtin)

		this.#userconfig.on('keyChanged', (key) => {
			if (key === 'installName') {
				this.#events.emit('self', this.#getSelfInfo())
				this.#announce(null)
			}
			for (const builtin of builtinTransports) {
				if (builtin.userConfigKeys.includes(key)) this.#applyBuiltin(builtin)
			}
		})
	}

	/** Configure a built-in transport from the user config */
	#applyBuiltin(builtin: SomeLinkBuiltinTransport): void {
		this.#transports
			.setBuiltin(builtin.id, builtin.definition.type, builtin.definition.name, builtin.getConfig(this.#userconfig))
			.catch((e) => this.#logger.error(`Failed to configure ${builtin.definition.name}: ${stringifyError(e)}`))
	}

	/** Start linking. Called once the rest of Companion is ready */
	start(): void {
		this.#started = true

		this.#peers.start()
		this.#transports.start()

		this.#announceTimer = setInterval(() => {
			this.#announce(null)
			this.#pinger.pingAll(Date.now())
		}, LINK_ANNOUNCE_INTERVAL_MS)
	}

	/** Say goodbye to peers and stop all transports */
	async stop(): Promise<void> {
		// So that an id regeneration still in progress doesn't start the transports again
		this.#started = false
		if (this.#announceTimer) clearInterval(this.#announceTimer)
		this.#announceTimer = null
		this.#pinger.clear()

		this.#peers.stop()

		await this.#transports.stopAll()
		// An id regeneration in progress saves the new identity, which must happen before the database is closed
		await this.#regenerating.catch(() => {})
	}

	#getSelfInfo(): LinkSelfInfo {
		const installName = String(this.#userconfig.getKey('installName') || '').trim()
		return {
			id: this.#selfId,
			fingerprint: formatLinkIdFingerprint(this.#selfId),
			name: installName || os.hostname(),
			protocolVersions: [...LINK_PROTOCOL_VERSIONS],
		}
	}

	/**
	 * Make our announcement known
	 * @param transportId - the transport to announce on, or null for all of them
	 */
	#announce(transportId: string | null): void {
		const self = this.#getSelfInfo()

		const payload = encodeLinkAnnouncement({
			name: self.name,
			companionVersion: this.#appInfo.appVersion,
			protocolVersions: self.protocolVersions,
			announceIntervalMs: LINK_ANNOUNCE_INTERVAL_MS,
		})

		if (transportId) {
			this.#transports.announceOn(transportId, payload)
		} else {
			this.#transports.announceAll(payload)
		}
	}

	/** Tell a peer what it may use of this installation, over a transport it is reachable on */
	#sendAccess(peerId: string, transportId: string): void {
		const permissions = this.#permissions.get(peerId)
		this.#transports.sendTo(transportId, peerId, encodeLinkMessage('access', { permissions }))
	}

	#handleAnnouncement(transportId: string, peerId: string, raw: string | null): void {
		if (raw === null) {
			this.#peers.handleGoodbye(transportId, peerId)
			return
		}

		const decoded = decodeLinkAnnouncement(raw)
		if (decoded.ok) {
			this.#peers.handleAnnouncement(transportId, peerId, decoded.announcement, Date.now())
		} else {
			this.#logger.debug(`Ignoring invalid announcement from ${peerId}: ${decoded.error}`)
		}
	}

	#handleMessage(transportId: string, raw: string, origin: LinkMessageOrigin): void {
		// Who sent it is decided by the transport, not the message
		const senderId = origin.peerId

		// A message is in the major version negotiated with its sender, so it can only be read once the sender has
		// announced itself. There is only version 1 so far
		if (!this.#peers.getPeer(senderId)?.compatible) {
			this.#logger.debug(`Ignoring a message from ${senderId}, as it has no protocol version in common with us`)
			return
		}

		const decoded = decodeLinkMessage(raw)
		if (!decoded.ok) {
			this.#logger.debug(`Ignoring invalid message from ${senderId}: ${decoded.error}`)
			return
		}

		const message = decoded.message
		switch (message.type) {
			case 'access':
				this.#peers.handleAccess(senderId, message.payload.permissions)
				break
			case 'ping':
				// Answered over the transport it came on, so that the round trip is measured over it
				this.#transports.sendTo(
					transportId,
					senderId,
					encodeLinkMessage('pong', { nonce: message.payload.nonce, time: Date.now() })
				)
				break
			case 'pong':
				this.#pinger.handlePong(senderId, transportId, message.payload.nonce, message.payload.time, Date.now())
				break
			default:
				// Button messages are not handled yet
				this.#logger.debug(`Unhandled message type ${message.type} from ${senderId}`)
				break
		}
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
		const regeneration = this.#regenerating.catch(() => {}).then(async () => this.#doRegenerateId())
		this.#regenerating = regeneration
		return regeneration
	}

	async #doRegenerateId(): Promise<void> {
		// Say goodbye as the old id. Peers expire the subscriptions held for it, and we subscribe again under the
		// new id once they are rediscovered
		await this.#transports.stopAll()

		this.#identity = LinkIdentity.generate()
		this.#table.setPrimitive('identity', this.#identity.toStored())
		this.#selfId = this.#identity.id
		this.#peers.setSelfId(this.#selfId)

		if (this.#started) this.#transports.start()

		this.#events.emit('self', this.#getSelfInfo())
	}

	/** The entries reported by transports that need the user's attention, eg pairing requests */
	#getAttention(): string[] {
		return Object.values(this.#transports.getStates()).flatMap((state) =>
			state.sections
				.filter((section) => section.attention)
				.flatMap((section) => section.entries.map((entry) => `${section.title}: ${entry.title}`))
		)
	}

	createTrpcRouter() {
		const self = this
		return router({
			transportTypes: publicProcedure.query((): ClientLinkTransportType[] => [
				...self.#transportDefinitions.map((def) => ({
					type: def.type,
					name: def.name,
					description: def.description,
					configFields: def.configFields,
					builtin: false,
				})),
				...self.#builtinTransports.map(({ definition }) => ({
					type: definition.type,
					name: definition.name,
					description: definition.description,
					configFields: definition.configFields,
					builtin: true,
				})),
			]),

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

			/** What needs the user's attention (eg pairing requests), for the navigation to show a count of */
			watchAttention: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#transports.events, 'states', signal)
				let last = self.#getAttention()
				yield last
				for await (const _change of changes) {
					const attention = self.#getAttention()
					if (isEqual(attention, last)) continue
					last = attention
					yield attention
				}
			}),

			watchTransportStates: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#transports.events, 'states', signal)
				yield { type: 'init', items: self.#transports.getStates() } as const
				for await (const [update] of changes) yield update
			}),

			addTransport: publicProcedure
				.input(z.object({ type: z.string(), label: z.string().trim().min(1).max(100), config: JsonObjectSchema }))
				.mutation(({ input }) => this.#transports.add(input.type, input.label, input.config)),

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
