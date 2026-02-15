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
import {
	discoveryTopic,
	discoveryWildcard,
	updateTopic,
	updateWildcard,
	pressTopic,
	releaseTopic,
	pressWildcard,
	releaseWildcard,
	rpcRequestTopic,
	rpcResponseTopic,
	rpcRequestWildcard,
	LINK_TOPIC_PREFIX,
	type AnnouncementMessage,
	type AnnouncementPayload,
	type SubscribeRequestMessage,
	type SubscribeResponseMessage,
	type ButtonUpdateMessage,
	type ButtonPressMessage,
	type ButtonReleaseMessage,
	type LinkMessage,
} from './Protocol.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { IPageStore } from '../Page/Store.js'
import type { ControlsController } from '../Controls/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import { SubscriptionManager } from './SubscriptionManager.js'
import { BitmapRenderer } from './BitmapRenderer.js'
import { ControlButtonRemoteLink } from '../Controls/ControlTypes/LinkButton.js'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'

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
 * Manages transports, peer discovery, announcement lifecycle,
 * inbound subscriptions (other peers reading our buttons), and
 * outbound subscriptions (our link buttons reading remote buttons).
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

	// Phase 2+3 dependencies
	readonly #controls: ControlsController
	readonly #controlEvents: EventEmitter<ControlCommonEvents>

	// Phase 2: Inbound (other peers subscribing to our buttons)
	readonly #subscriptionManager: SubscriptionManager
	readonly #bitmapRenderer: BitmapRenderer

	// Phase 3: Outbound (our link buttons subscribing to remote buttons)
	/** Map of controlId → tracked subscription info */
	readonly #outboundSubs = new Map<
		string,
		{ peerUuid: string; page: number; row: number; col: number; subscribed: boolean }
	>()

	/** Set of peer UUIDs we are currently listening on for updates */
	readonly #subscribedUpdatePeers = new Set<string>()

	/** Pending RPC response callbacks keyed by correlationId */
	readonly #pendingRpc = new Map<string, (msg: LinkMessage) => void>()

	/** Current controller state */
	#state: LinkControllerState

	/** Transport configurations */
	#transportConfigs: LinkTransportConfig[]

	/** Announcement interval handle */
	#announcementInterval: ReturnType<typeof setInterval> | null = null

	constructor(
		appInfo: AppInfo,
		db: DataDatabase,
		userconfig: DataUserConfig,
		pageStore: IPageStore,
		controls: ControlsController,
		graphics: GraphicsController,
		controlEvents: EventEmitter<ControlCommonEvents>
	) {
		this.#appInfo = appInfo
		this.#userconfig = userconfig
		this.#pageStore = pageStore
		this.#controls = controls
		this.#controlEvents = controlEvents
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
			// Re-evaluate link button states when peer availability changes
			this.#updateLinkButtonStates()
		})

		// Phase 2: Inbound subscription system
		this.#subscriptionManager = new SubscriptionManager()
		this.#bitmapRenderer = new BitmapRenderer(graphics, this.#subscriptionManager)

		// When BitmapRenderer has a rendered bitmap, publish it
		this.#bitmapRenderer.on('bitmapReady', (bitmap) => {
			this.#publishButtonUpdate(
				bitmap.page,
				bitmap.row,
				bitmap.col,
				bitmap.width,
				bitmap.height,
				bitmap.dataUrl,
				bitmap.pressed
			)
		})

		// When a subscription is removed, evict the bitmap cache
		this.#subscriptionManager.on('subscriptionRemoved', (page, row, col, width, height) => {
			this.#bitmapRenderer.evictCache(page, row, col, width, height)
		})

		// Phase 3: React to link button creation/deletion
		this.#controlEvents.on('controlCountChanged', () => {
			this.#syncOutboundSubscriptions()
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

		// Subscribe to inbound RPC requests (other peers subscribing to our buttons)
		await this.#transportManager.subscribeAll(rpcRequestWildcard(this.#state.uuid))

		// Subscribe to inbound press/release commands for our buttons
		await this.#transportManager.subscribeAll(pressWildcard(this.#state.uuid))
		await this.#transportManager.subscribeAll(releaseWildcard(this.#state.uuid))

		// Start the bitmap renderer (listens for button_drawn events)
		this.#bitmapRenderer.start()

		// Send initial announcement
		await this.#sendAnnouncement()

		// Start periodic announcements
		this.#announcementInterval = setInterval(() => {
			this.#sendAnnouncement().catch((e) => {
				this.#logger.warn(`Failed to send periodic announcement: ${stringifyError(e)}`)
			})
		}, ANNOUNCEMENT_INTERVAL)

		// Initial scan for existing link buttons
		this.#syncOutboundSubscriptions()
	}

	async #stop(): Promise<void> {
		this.#logger.info('Stopping Link service')

		if (this.#announcementInterval) {
			clearInterval(this.#announcementInterval)
			this.#announcementInterval = null
		}

		// Stop bitmap renderer
		this.#bitmapRenderer.stop()

		// Clear inbound subscriptions
		this.#subscriptionManager.clear()

		// Clear outbound subscriptions
		this.#outboundSubs.clear()
		this.#subscribedUpdatePeers.clear()
		this.#pendingRpc.clear()

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
		const prefix = `${LINK_TOPIC_PREFIX}/`
		if (!topic.startsWith(prefix)) return

		if (topic.startsWith(`${LINK_TOPIC_PREFIX}/discovery/`)) {
			this.#handleDiscoveryMessage(transportId, topic, payload)
			return
		}

		// Parse topic: companion-link/<uuid>/...
		const rest = topic.slice(prefix.length)
		const slashIdx = rest.indexOf('/')
		if (slashIdx === -1) return

		const topicUuid = rest.slice(0, slashIdx)
		const subPath = rest.slice(slashIdx + 1)

		// Inbound RPC requests to our UUID
		if (topicUuid === this.#state.uuid && subPath.startsWith('rpc/')) {
			this.#handleRpcRequest(transportId, subPath, payload)
			return
		}

		// Inbound press/release commands to our UUID
		if (topicUuid === this.#state.uuid && subPath.startsWith('location/')) {
			this.#handleInboundCommand(subPath, payload)
			return
		}

		// Inbound RPC responses (to our UUID, for our pending RPC calls)
		if (topicUuid === this.#state.uuid && subPath.startsWith('rpc/') && subPath.endsWith('/response')) {
			// Handled above implicitly; but let's be explicit
			return
		}

		// Outbound: button update from a remote peer we've subscribed to
		if (topicUuid !== this.#state.uuid && subPath.startsWith('location/') && subPath.includes('/update/')) {
			this.#handleRemoteButtonUpdate(topicUuid, subPath, payload)
			return
		}

		this.#logger.silly(`Unhandled message on topic: ${topic}`)
	}

	/**
	 * Handle an inbound RPC request (subscribe/unsubscribe from another peer).
	 */
	#handleRpcRequest(transportId: string, subPath: string, payload: Buffer): void {
		// subPath format: rpc/<correlationId>/request
		const match = subPath.match(/^rpc\/([^/]+)\/request$/)
		if (!match) return

		const correlationId = match[1]

		let message: LinkMessage
		try {
			message = JSON.parse(payload.toString('utf-8')) as LinkMessage
		} catch {
			this.#logger.warn(`Failed to parse RPC request`)
			return
		}

		if (message.type === 'subscribe.request') {
			this.#handleSubscribeRequest(transportId, correlationId, message as SubscribeRequestMessage)
		} else if (message.type === 'unsubscribe.request') {
			this.#handleUnsubscribeRequest(message.payload)
		} else {
			this.#logger.warn(`Unknown RPC request type: ${message.type}`)
		}
	}

	/**
	 * Handle a subscribe request from a remote peer.
	 */
	#handleSubscribeRequest(_transportId: string, correlationId: string, message: SubscribeRequestMessage): void {
		const requestorId = message.payload.requestorId

		const responseButtons: Array<{
			page: number
			row: number
			col: number
			width: number
			height: number
			pressed: boolean
			dataUrl: string | null
			sourceChain: string[]
		}> = []

		for (const btn of message.payload.buttons) {
			this.#subscriptionManager.subscribe(requestorId, btn.page, btn.row, btn.col, btn.width, btn.height)

			// Get current state
			const cached = this.#bitmapRenderer.getCached(btn.page, btn.row, btn.col, btn.width, btn.height)

			// Check if the button is currently pressed
			const location = { pageNumber: btn.page, row: btn.row, column: btn.col }
			const controlId = this.#pageStore.getControlIdAt(location)
			const control = controlId ? this.#controls.getControl(controlId) : undefined
			const pressed = control?.supportsPushed ? false : false // TODO: get actual pressed state

			responseButtons.push({
				page: btn.page,
				row: btn.row,
				col: btn.col,
				width: btn.width,
				height: btn.height,
				pressed,
				dataUrl: cached ?? null,
				sourceChain: [this.#state.uuid],
			})

			// If no cached render, render on demand
			if (!cached) {
				this.#bitmapRenderer
					.renderOnDemand(btn.page, btn.row, btn.col, btn.width, btn.height)
					.then((result) => {
						if (result) {
							this.#publishButtonUpdate(
								btn.page,
								btn.row,
								btn.col,
								btn.width,
								btn.height,
								result.dataUrl,
								result.pressed
							)
						}
					})
					.catch((err) => {
						this.#logger.warn(`Failed to render on demand: ${stringifyError(err)}`)
					})
			}
		}

		// Send subscribe response back to the requestor
		const responseMsg: SubscribeResponseMessage = {
			version: 1,
			type: 'subscribe.response',
			payload: {
				states: responseButtons,
				timestamp: Date.now(),
			},
		}

		const responseTopic = rpcResponseTopic(requestorId, correlationId)
		this.#transportManager.publishToAll(responseTopic, JSON.stringify(responseMsg)).catch((err) => {
			this.#logger.warn(`Failed to send subscribe response to ${requestorId}: ${stringifyError(err)}`)
		})

		this.#logger.debug(
			`Processed subscribe request from ${requestorId} with ${message.payload.buttons.length} buttons (correlationId=${correlationId})`
		)
	}

	/**
	 * Handle an unsubscribe request from a remote peer.
	 */
	#handleUnsubscribeRequest(payload: unknown): void {
		const unsubPayload = payload as {
			buttons?: Array<{ page: number; row: number; col: number; width: number; height: number }>
		}
		if (unsubPayload.buttons) {
			for (const btn of unsubPayload.buttons) {
				this.#subscriptionManager.unsubscribe('remote', btn.page, btn.row, btn.col, btn.width, btn.height)
			}
		}
	}

	/**
	 * Handle an inbound press/release command (remote peer pressing one of our buttons).
	 */
	#handleInboundCommand(subPath: string, payload: Buffer): void {
		// subPath format: location/<page>/<row>/<col>/press or /release
		const match = subPath.match(/^location\/(\d+)\/(\d+)\/(\d+)\/(press|release)$/)
		if (!match) return

		const page = Number(match[1])
		const row = Number(match[2])
		const col = Number(match[3])
		const action = match[4]

		// Parse the payload to extract sourceUuid and surfaceId
		let message: ButtonPressMessage | ButtonReleaseMessage
		try {
			message = JSON.parse(payload.toString('utf-8'))
		} catch {
			this.#logger.warn(`Failed to parse inbound ${action} command`)
			return
		}

		const sourceUuid = message.payload.sourceUuid
		const remoteSurfaceId = message.payload.surfaceId

		// Prepend source UUID to surfaceId to make it globally unique
		const surfaceId = remoteSurfaceId ? `${sourceUuid}:${remoteSurfaceId}` : undefined

		const location = { pageNumber: page, row, column: col }
		const controlId = this.#pageStore.getControlIdAt(location)
		if (!controlId) {
			this.#logger.debug(`No control at page=${page} row=${row} col=${col} for inbound ${action}`)
			return
		}

		this.#logger.debug(
			`Inbound ${action} for control ${controlId} at page=${page} row=${row} col=${col} from ${sourceUuid}`
		)
		this.#controls.pressControl(controlId, action === 'press', surfaceId)
	}

	/**
	 * Handle a button update message from a remote peer (for our outbound subscriptions).
	 */
	#handleRemoteButtonUpdate(peerUuid: string, subPath: string, payload: Buffer): void {
		// subPath format: location/<page>/<row>/<col>/update/<WxH>
		const match = subPath.match(/^location\/(\d+)\/(\d+)\/(\d+)\/update\/(\d+)x(\d+)$/)
		if (!match) return

		const page = Number(match[1])
		const row = Number(match[2])
		const col = Number(match[3])

		let message: ButtonUpdateMessage
		try {
			message = JSON.parse(payload.toString('utf-8')) as ButtonUpdateMessage
		} catch {
			this.#logger.warn(`Failed to parse button update from ${peerUuid}`)
			return
		}

		if (message.type !== 'button.update') return

		const updatePayload = message.payload

		// Loop detection: check if our UUID is in the source chain
		const isLoop = updatePayload.sourceChain?.includes(this.#state.uuid)

		// Find all link buttons targeting this peer + location
		for (const [controlId, sub] of this.#outboundSubs) {
			if (sub.peerUuid === peerUuid && sub.page === page && sub.row === row && sub.col === col) {
				const control = this.#controls.getControl(controlId)
				if (control instanceof ControlButtonRemoteLink) {
					if (isLoop) {
						control.setVisualState('loop_detected')
					} else if (updatePayload.dataUrl) {
						control.setBitmap(updatePayload.dataUrl, updatePayload.pressed ?? false)
					}
				}
			}
		}
	}

	/**
	 * Publish a button update for a subscribed location.
	 */
	#publishButtonUpdate(
		page: number,
		row: number,
		col: number,
		width: number,
		height: number,
		dataUrl: string,
		pressed: boolean
	): void {
		if (!this.#state.enabled) return

		const updateMsg: ButtonUpdateMessage = {
			version: 1,
			type: 'button.update',
			payload: {
				page,
				row,
				col,
				width,
				height,
				pressed,
				dataUrl,
				sourceChain: [this.#state.uuid],
				timestamp: Date.now(),
			},
		}

		const topic = updateTopic(this.#state.uuid, page, row, col, width, height)
		this.#transportManager.publishToAll(topic, JSON.stringify(updateMsg)).catch((err) => {
			this.#logger.warn(`Failed to publish button update: ${stringifyError(err)}`)
		})
	}

	// ── Phase 3: Outbound Subscription Management ────────────────────

	/**
	 * Scan all controls for remotelinkbutton types and synchronize outbound subscriptions.
	 */
	#syncOutboundSubscriptions(): void {
		if (!this.#state.enabled) return

		const allControls = this.#controls.getAllControls()
		const activeControlIds = new Set<string>()

		// Find all link buttons and register/update subscriptions
		for (const [controlId, control] of allControls) {
			if (!(control instanceof ControlButtonRemoteLink)) continue

			activeControlIds.add(controlId)

			const peerUuid = control.peerUuid
			const parsedLocation = control.parseLocation(undefined)

			const page = parsedLocation?.pageNumber
			const row = parsedLocation?.row
			const col = parsedLocation?.column

			if (!peerUuid || page === undefined || row === undefined || col === undefined) {
				// Not fully configured or location contains unresolved variables
				control.setVisualState('unknown_peer')

				// Set up the press handler even if not configured
				control.setOnPress((cid, pressed, surfaceId) => {
					this.#handleLinkButtonPress(cid, pressed, surfaceId)
				})

				// Remove from outbound if previously tracked
				this.#outboundSubs.delete(controlId)
				continue
			}

			// Set up press handler
			control.setOnPress((cid, pressed, surfaceId) => {
				this.#handleLinkButtonPress(cid, pressed, surfaceId)
			})

			// Set up config change handler
			control.setOnConfigChanged(() => {
				this.#syncOutboundSubscriptions()
			})

			// Set peer name from registry
			const peer = this.#peerRegistry.getPeers().find((p) => p.id === peerUuid)
			control.setPeerName(peer?.name ?? null)

			// Check peer status
			if (!peer) {
				control.setVisualState('unknown_peer')
				this.#outboundSubs.delete(controlId)
				continue
			}

			if (!peer.online) {
				control.setVisualState('unreachable')
				this.#outboundSubs.delete(controlId)
				continue
			}

			// Track the subscription
			const existing = this.#outboundSubs.get(controlId)
			if (
				!existing ||
				existing.peerUuid !== peerUuid ||
				existing.page !== page ||
				existing.row !== row ||
				existing.col !== col
			) {
				// New or changed subscription
				this.#outboundSubs.set(controlId, { peerUuid, page, row, col, subscribed: false })
				control.setVisualState('loading')

				// Ensure we're listening for updates from this peer
				this.#ensureUpdateSubscription(peerUuid)

				// Send subscribe request
				this.#sendSubscribeRequest(peerUuid, page, row, col)
			}
		}

		// Clean up removed link buttons
		for (const [controlId] of this.#outboundSubs) {
			if (!activeControlIds.has(controlId)) {
				this.#outboundSubs.delete(controlId)
			}
		}

		// Clean up update subscriptions for peers no longer referenced
		this.#cleanUnusedPeerSubscriptions()
	}

	/**
	 * Update visual state of link buttons when peer availability changes.
	 */
	#updateLinkButtonStates(): void {
		if (!this.#state.enabled) return

		for (const [controlId, sub] of this.#outboundSubs) {
			const control = this.#controls.getControl(controlId)
			if (!(control instanceof ControlButtonRemoteLink)) continue

			const peer = this.#peerRegistry.getPeers().find((p) => p.id === sub.peerUuid)
			control.setPeerName(peer?.name ?? null)

			if (!peer) {
				control.setVisualState('unknown_peer')
			} else if (!peer.online) {
				control.setVisualState('unreachable')
			} else if (control.visualState === 'unreachable' || control.visualState === 'unknown_peer') {
				// Peer came back online, re-subscribe
				control.setVisualState('loading')
				this.#ensureUpdateSubscription(sub.peerUuid)
				this.#sendSubscribeRequest(sub.peerUuid, sub.page, sub.row, sub.col)
			}
		}
	}

	/**
	 * Ensure we're subscribed to button updates from a specific peer on MQTT.
	 */
	#ensureUpdateSubscription(peerUuid: string): void {
		if (this.#subscribedUpdatePeers.has(peerUuid)) return
		this.#subscribedUpdatePeers.add(peerUuid)

		this.#transportManager.subscribeAll(updateWildcard(peerUuid)).catch((err) => {
			this.#logger.warn(`Failed to subscribe to updates from ${peerUuid}: ${stringifyError(err)}`)
		})
	}

	/**
	 * Unsubscribe from peers that are no longer needed.
	 */
	#cleanUnusedPeerSubscriptions(): void {
		const neededPeers = new Set<string>()
		for (const sub of this.#outboundSubs.values()) {
			neededPeers.add(sub.peerUuid)
		}

		for (const peerUuid of this.#subscribedUpdatePeers) {
			if (!neededPeers.has(peerUuid)) {
				this.#subscribedUpdatePeers.delete(peerUuid)
				this.#transportManager.unsubscribeAll(updateWildcard(peerUuid)).catch((err) => {
					this.#logger.warn(`Failed to unsubscribe from ${peerUuid}: ${stringifyError(err)}`)
				})
			}
		}
	}

	/**
	 * Send a subscribe request to a remote peer.
	 */
	#sendSubscribeRequest(peerUuid: string, page: number, row: number, col: number): void {
		const msg: SubscribeRequestMessage = {
			version: 1,
			type: 'subscribe.request',
			payload: {
				requestorId: this.#state.uuid,
				buttons: [
					{
						page,
						row,
						col,
						width: 72,
						height: 72,
					},
				],
				timestamp: Date.now(),
			},
		}

		const correlationId = v4()
		const topic = rpcRequestTopic(peerUuid, correlationId)
		this.#transportManager.publishToAll(topic, JSON.stringify(msg)).catch((err) => {
			this.#logger.warn(`Failed to send subscribe request to ${peerUuid}: ${stringifyError(err)}`)
		})
	}

	/**
	 * Handle a press on a local link button — forward press/release to the remote peer.
	 */
	#handleLinkButtonPress(controlId: string, pressed: boolean, surfaceId: string | undefined): void {
		const sub = this.#outboundSubs.get(controlId)
		if (!sub) return

		const topic = pressed
			? pressTopic(sub.peerUuid, sub.page, sub.row, sub.col)
			: releaseTopic(sub.peerUuid, sub.page, sub.row, sub.col)

		const msg: ButtonPressMessage | ButtonReleaseMessage = {
			version: 1,
			type: pressed ? 'button.press' : 'button.release',
			payload: {
				page: sub.page,
				row: sub.row,
				col: sub.col,
				sourceUuid: this.#state.uuid,
				surfaceId,
				timestamp: Date.now(),
			},
		}

		this.#transportManager.publishToAll(topic, JSON.stringify(msg)).catch((err) => {
			this.#logger.warn(`Failed to forward press to ${sub.peerUuid}: ${stringifyError(err)}`)
		})
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
