import isEqual from 'fast-deep-equal'
import { v4 } from 'uuid'
import EventEmitter from 'node:events'
import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import type { DataDatabase } from '../Data/Database.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import {
	DEFAULT_MQTT_CONFIG,
	type LinkControllerState,
	type LinkPeerInfo,
	type LinkTransportConfig,
	type LinkTransportState,
} from '@companion-app/shared/Model/Link.js'
import { TransportManager } from './TransportManager.js'
import { PeerRegistry } from './PeerRegistry.js'
import { discoveryTopic, discoveryWildcard, type AnnouncementMessage, type AnnouncementPayload } from './Protocol.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { IPageStore } from '../Page/Store.js'

const LINK_TABLE = 'link'

/** Announcement interval in ms (60 seconds) */
const ANNOUNCEMENT_INTERVAL = 15_000

/** DB schema for the link table */
interface LinkDbTable {
	uuid: string
	settings: LinkSettings
	transports: LinkTransportConfig[]
}

interface LinkSettings {
	enabled: boolean
}

/** Events emitted to the UI via tRPC subscriptions */
export type LinkUIEvents = {
	controllerState: [state: LinkControllerState]
	transportStates: [states: LinkTransportState[]]
	peers: [peers: LinkPeerInfo[]]
	transports: [configs: LinkTransportConfig[]]
}

/**
 * Main orchestrator for the Companion Link system.
 * Manages transports, peer discovery, and announcement lifecycle.
 */
export class LinkController {
	readonly #logger = LogController.createLogger('Link/Controller')

	readonly #appInfo: AppInfo
	readonly #userconfig: DataUserConfig
	readonly #pageStore: IPageStore
	readonly #dbTable: DataStoreTableView<LinkDbTable>
	readonly #transportManager: TransportManager
	readonly #peerRegistry: PeerRegistry
	readonly #uiEvents = new EventEmitter<LinkUIEvents>()

	/** Current controller state */
	#state: LinkControllerState

	/** Transport configurations */
	#transportConfigs: LinkTransportConfig[]

	/** Announcement interval handle */
	#announcementInterval: ReturnType<typeof setInterval> | null = null

	constructor(appInfo: AppInfo, db: DataDatabase, userconfig: DataUserConfig, pageStore: IPageStore) {
		this.#appInfo = appInfo
		this.#userconfig = userconfig
		this.#pageStore = pageStore
		this.#dbTable = db.getTableView(LINK_TABLE)

		this.#uiEvents.setMaxListeners(0)

		// Load or initialize state from DB
		const uuid = this.#dbTable.getPrimitiveOrDefault('uuid', v4())

		const settings = this.#dbTable.getOrDefault('settings', {
			enabled: false,
		})

		this.#state = { enabled: settings.enabled, uuid }

		// Load transport configurations
		this.#transportConfigs = this.#dbTable.getOrDefault('transports', [])

		// Create managers
		this.#transportManager = new TransportManager()
		this.#peerRegistry = new PeerRegistry(uuid)

		// Wire transport manager events
		this.#transportManager.on('transportStatusChanged', (states: LinkTransportState[]) => {
			this.#uiEvents.emit('transportStates', states)
		})

		this.#transportManager.on('message', (_transportId: string, topic: string, payload: Buffer) => {
			this.#handleIncomingMessage(_transportId, topic, payload)
		})

		// Wire peer registry events
		this.#peerRegistry.on('peersChanged', (peers: LinkPeerInfo[]) => {
			this.#uiEvents.emit('peers', peers)
		})

		// Start if enabled
		if (settings.enabled) {
			this.#start().catch((e) => {
				this.#logger.error(`Failed to start Link service: ${stringifyError(e)}`)
			})
		}

		// Re-announce when Installation Name or gridSize changes
		this.#userconfig.on('keyChanged', (key) => {
			if ((key === 'installName' || key === 'gridSize') && this.#state.enabled) {
				this.#sendAnnouncement().catch((e) => {
					this.#logger.warn(`Failed to re-announce after ${key} change: ${stringifyError(e)}`)
				})
			}
		})

		// Re-announce when page count changes
		this.#pageStore.on('pagecount', () => {
			if (this.#state.enabled) {
				this.#sendAnnouncement().catch((e) => {
					this.#logger.warn(`Failed to re-announce after page count change: ${stringifyError(e)}`)
				})
			}
		})
	}

	createTrpcRouter() {
		const self = this
		return router({
			// ── State subscription ──────────────────────────────────────
			watchState: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#uiEvents, 'controllerState', signal)
				yield self.#state
				for await (const [change] of changes) {
					yield change
				}
			}),

			// ── Transport states subscription ───────────────────────────
			watchTransportStates: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#uiEvents, 'transportStates', signal)
				yield self.#transportManager.getTransportStates()
				for await (const [change] of changes) {
					yield change
				}
			}),

			// ── Peers subscription ──────────────────────────────────────
			watchPeers: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#uiEvents, 'peers', signal)
				yield self.#peerRegistry.getPeers()
				for await (const [change] of changes) {
					yield change
				}
			}),

			// ── Transport configs subscription ──────────────────────────
			watchTransportConfigs: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#uiEvents, 'transports', signal)
				yield self.#transportConfigs
				for await (const [change] of changes) {
					yield change
				}
			}),

			// ── Enable / disable Link ───────────────────────────────────
			setEnabled: publicProcedure.input(z.object({ enabled: z.boolean() })).mutation(async ({ input }) => {
				if (input.enabled === this.#state.enabled) return

				this.#setState({ enabled: input.enabled })
				this.#saveSettings()

				if (input.enabled) {
					await this.#start()
				} else {
					await this.#stop()
				}
			}),

			// ── Regenerate UUID ──────────────────────────────────────────
			regenerateUUID: publicProcedure.mutation(async () => {
				const newUuid = v4()
				this.#setState({ uuid: newUuid })
				this.#dbTable.setPrimitive('uuid', newUuid)
				this.#peerRegistry.setSelfUuid(newUuid)

				// If running, re-announce with new UUID
				if (this.#state.enabled) {
					await this.#sendAnnouncement()
				}
			}),

			// ── Add transport ───────────────────────────────────────────
			addTransport: publicProcedure
				.input(
					z.object({
						type: z.enum(['mqtt']),
						label: z.string().min(1).max(100),
					})
				)
				.mutation(async ({ input }) => {
					const config: LinkTransportConfig = {
						id: v4(),
						type: input.type,
						label: input.label,
						enabled: false,
						config: DEFAULT_MQTT_CONFIG,
					}

					this.#transportConfigs.push(config)
					this.#saveTransportConfigs()

					if (this.#state.enabled) {
						await this.#transportManager.addTransport(config)
					}

					return config.id
				}),

			// ── Update transport config ─────────────────────────────────
			updateTransport: publicProcedure
				.input(
					z.object({
						id: z.string(),
						label: z.string().min(1).max(100).optional(),
						enabled: z.boolean().optional(),
						config: z
							.object({
								brokerUrl: z.string().optional(),
								username: z.string().optional(),
								password: z.string().optional(),
								tls: z.boolean().optional(),
							})
							.optional(),
					})
				)
				.mutation(async ({ input }) => {
					const idx = this.#transportConfigs.findIndex((t) => t.id === input.id)
					if (idx === -1) throw new Error(`Transport ${input.id} not found`)

					const existing = this.#transportConfigs[idx]

					const updated: LinkTransportConfig = {
						...existing,
						label: input.label ?? existing.label,
						enabled: input.enabled ?? existing.enabled,
						config: {
							...existing.config,
							...input.config,
						},
					}

					this.#transportConfigs[idx] = updated
					this.#saveTransportConfigs()

					if (this.#state.enabled) {
						await this.#transportManager.addTransport(updated)
					}
				}),

			// ── Remove transport ────────────────────────────────────────
			removeTransport: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
				const idx = this.#transportConfigs.findIndex((t) => t.id === input.id)
				if (idx === -1) return

				this.#transportConfigs.splice(idx, 1)
				this.#saveTransportConfigs()

				this.#peerRegistry.removeTransport(input.id)
				await this.#transportManager.removeTransport(input.id)
			}),

			// ── Delete a discovered peer ────────────────────────────────
			deletePeer: publicProcedure.input(z.object({ peerId: z.string() })).mutation(({ input }) => {
				this.#peerRegistry.deletePeer(input.peerId)
			}),
		})
	}

	/**
	 * Shutdown the Link controller.
	 */
	async destroy(): Promise<void> {
		await this.#stop()
	}

	// ── Private Lifecycle ─────────────────────────────────────────────

	async #start(): Promise<void> {
		this.#logger.info('Starting Link service')
		this.#peerRegistry.start()

		// Start all configured transports
		for (const config of this.#transportConfigs) {
			await this.#transportManager.addTransport(config)
		}

		// Subscribe to discovery announcements
		await this.#transportManager.subscribeAll(discoveryWildcard())

		// Send initial announcement
		await this.#sendAnnouncement()

		// Start periodic announcements
		this.#announcementInterval = setInterval(() => {
			this.#sendAnnouncement().catch((e) => {
				this.#logger.warn(`Failed to send periodic announcement: ${stringifyError(e)}`)
			})
		}, ANNOUNCEMENT_INTERVAL)
	}

	async #stop(): Promise<void> {
		this.#logger.info('Stopping Link service')

		if (this.#announcementInterval) {
			clearInterval(this.#announcementInterval)
			this.#announcementInterval = null
		}

		// Send empty retained message to signal offline
		try {
			await this.#transportManager.publishToAll(discoveryTopic(this.#state.uuid), '', { retain: true })
		} catch (e) {
			this.#logger.warn(`Failed to send offline announcement: ${stringifyError(e)}`)
		}

		this.#peerRegistry.stop()
		await this.#transportManager.removeAll()
	}

	async #sendAnnouncement(): Promise<void> {
		const installName = this.#userconfig.getKey('installName') as string
		const name =
			installName && installName.length > 0 ? installName : `Companion (${this.#appInfo.machineId.slice(0, 8)})`

		const gridSize = this.#userconfig.getKey('gridSize')
		const pageCount = this.#pageStore.getPageCount()

		const payload: AnnouncementPayload = {
			id: this.#state.uuid,
			name,
			version: this.#appInfo.appVersion,
			protocolVersion: 1,
			pageCount,
			gridSize: {
				rows: gridSize.maxRow - gridSize.minRow + 1,
				cols: gridSize.maxColumn - gridSize.minColumn + 1,
			},
			timestamp: Date.now(),
		}

		const message: AnnouncementMessage = {
			version: 1,
			type: 'announcement',
			payload,
		}

		const topic = discoveryTopic(this.#state.uuid)
		await this.#transportManager.publishToAll(topic, JSON.stringify(message), { retain: true })
	}

	// ── Message Handling ──────────────────────────────────────────────

	#handleIncomingMessage(transportId: string, topic: string, payload: Buffer): void {
		const discoveryPrefix = 'companion-link/discovery/'

		if (topic.startsWith(discoveryPrefix)) {
			this.#handleDiscoveryMessage(transportId, topic, payload)
			return
		}

		// Future: handle subscribe/unsubscribe, button presses, bitmap updates, etc.
		this.#logger.silly(`Unhandled message on topic: ${topic}`)
	}

	#handleDiscoveryMessage(transportId: string, _topic: string, payload: Buffer): void {
		const payloadStr = payload.toString('utf-8')

		this.#logger.debug(`Received discovery message on ${_topic} from transport ${transportId}`)

		// Empty payload = peer went offline (empty retained message)
		if (!payloadStr || payloadStr.length === 0) {
			// Extract peer UUID from topic
			const parts = _topic.split('/')
			const peerId = parts[parts.length - 1]
			if (peerId) {
				this.#logger.debug(`Peer ${peerId} went offline`)
				this.#peerRegistry.handlePeerOffline(transportId, peerId)
			}
			return
		}

		try {
			const message = JSON.parse(payloadStr) as AnnouncementMessage
			if (message.version !== 1 || message.type !== 'announcement') {
				this.#logger.warn(`Invalid announcement message format`)
				return
			}

			this.#logger.debug(`Processing announcement from peer ${message.payload.id}`)
			this.#peerRegistry.handleAnnouncement(transportId, message.payload)
		} catch (e) {
			this.#logger.warn(`Failed to parse discovery message: ${stringifyError(e)}`)
		}
	}

	// ── State Management ──────────────────────────────────────────────

	#setState(draftState: Partial<LinkControllerState>): void {
		const newState: LinkControllerState = {
			...this.#state,
			...draftState,
		}

		if (!isEqual(newState, this.#state)) {
			this.#state = newState
			this.#uiEvents.emit('controllerState', newState)
		}
	}

	#saveSettings(): void {
		this.#dbTable.set('settings', {
			enabled: this.#state.enabled,
		})
	}

	#saveTransportConfigs(): void {
		this.#dbTable.set('transports', this.#transportConfigs)
		this.#uiEvents.emit('transports', this.#transportConfigs)
	}
}
