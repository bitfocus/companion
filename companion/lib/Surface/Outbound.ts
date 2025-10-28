import { nanoid } from 'nanoid'
import LogController from '../Log/Controller.js'
import { DEFAULT_TCP_PORT, StreamDeckTcpConnectionManager } from '@elgato-stream-deck/tcp'
import { StreamDeckJpegOptions } from './USB/ElgatoStreamDeck.js'
import type { SurfaceController } from './Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import type {
	ModernOutboundSurfaceInfo,
	OutboundSurfaceInfo,
	OutboundSurfacesUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import { EventEmitter } from 'node:events'
import { assertNever } from '@companion-app/shared/Util.js'
import { OutboundSurfaceCollections } from './OutboundCollections.js'
import { isEqual } from 'lodash-es'
import { ServiceSurfaceDiscovery } from './Discovery.js'

export interface SurfaceOutboundControllerEvents {
	clientInfo: [update: OutboundSurfacesUpdate]
	[id: `startStop:${string}`]: [info: ModernOutboundSurfaceInfo]
}
export class SurfaceOutboundController {
	/**
	 * The logger for this class
	 */
	readonly #logger = LogController.createLogger('SurfaceOutboundController')

	readonly #controller: SurfaceController
	readonly #collections: OutboundSurfaceCollections

	readonly #discoveryController = new ServiceSurfaceDiscovery()

	/**
	 * The core database library
	 */
	readonly #dbTable: DataStoreTableView<Record<string, OutboundSurfaceInfo>>

	#storage = new Map<string, OutboundSurfaceInfo>()

	readonly #surfaceInstanceDefaultConfig = new Map<string, Record<string, any>>()

	readonly events = new EventEmitter<SurfaceOutboundControllerEvents>()
	readonly #enabledConnectionIds = new Set<string>()

	#streamdeckTcpConnectionManager = new StreamDeckTcpConnectionManager({
		jpegOptions: StreamDeckJpegOptions,
		autoConnectToSecondaries: true,
	})

	get discovery(): ServiceSurfaceDiscovery {
		return this.#discoveryController
	}

	constructor(controller: SurfaceController, db: DataDatabase) {
		this.#controller = controller
		this.#dbTable = db.getTableView('surfaces_remote')

		this.events.setMaxListeners(0)

		this.#collections = new OutboundSurfaceCollections(
			db,
			(validCollectionIds) => this.#cleanUnknownCollectionIds(validCollectionIds),
			() => {
				// // Emit event to trigger feedback updates for outbound surface collection enabled states
				// this.events.emit('clientInfo', {
				// 	type: 'init',
				// 	items: this.#storage,
				// })
			}
		)

		this.#collections = new OutboundSurfaceCollections(
			db,
			(validCollectionIds) => this.#cleanUnknownCollectionIds(validCollectionIds),
			() => this.#startStopAllConnections()
		)

		this.#streamdeckTcpConnectionManager.on('connected', (streamdeck) => {
			this.#logger.info(
				`Connected to TCP Streamdeck ${streamdeck.remoteAddress}:${streamdeck.remotePort} (${streamdeck.PRODUCT_NAME})`
			)

			this.#controller.addStreamdeckTcpDevice(streamdeck).catch((e) => {
				this.#logger.error(`Failed to add TCP Streamdeck: ${e}`)
				// TODO - how to handle?
				// streamdeck.close()
			})
		})
		this.#streamdeckTcpConnectionManager.on('error', (error) => {
			this.#logger.error(`Error from TCP Streamdeck: ${error}`)
		})
	}

	#cleanUnknownCollectionIds(validCollectionIds: ReadonlySet<string>): void {
		// Figure out the first sort order
		let nextSortOrder = 0
		for (const config of this.#storage.values()) {
			if (config && !config?.collectionId) {
				nextSortOrder = Math.max(nextSortOrder, config.sortOrder + 1)
			}
		}

		// Validate the collectionIds, and do something sensible with the sort order
		// Future: maybe this could try to preserve the order in some way?
		for (const [id, config] of this.#storage) {
			if (config && config.collectionId && !validCollectionIds.has(config.collectionId)) {
				config.collectionId = null
				config.sortOrder = nextSortOrder++

				this.events.emit('clientInfo', {
					type: 'add',
					itemId: id,
					info: config,
				})
				this.#startStopConnection(config)
			}
		}
	}

	/**
	 * Initialize the module, loading the configuration from the db
	 * @access public
	 */
	init(): void {
		this.#storage = new Map(Object.entries(this.#dbTable.all()))

		let sortOrderCounter = 0
		for (const surfaceInfo of this.#storage.values()) {
			// Fixup old config
			if (surfaceInfo.collectionId === undefined) surfaceInfo.collectionId = null
			if (surfaceInfo.sortOrder === undefined) surfaceInfo.sortOrder = sortOrderCounter
			sortOrderCounter++

			if (surfaceInfo.enabled === undefined) surfaceInfo.enabled = true // Fixup old config

			if (!surfaceInfo.enabled) {
				this.#logger.info(`Skipping disabled remote surface: ${surfaceInfo.displayName || surfaceInfo.id}`)
				continue
			}

			try {
				this.#startStopConnection(surfaceInfo)
			} catch (e) {
				this.#logger.error(`Unable to setup remote surface: ${surfaceInfo.displayName || surfaceInfo.id}: ${e}`)
			}
		}
	}

	updateDefaultConfigForSurfaceInstance(instanceId: string, defaultConfig: Record<string, any> | null): void {
		if (defaultConfig) {
			this.#surfaceInstanceDefaultConfig.set(instanceId, defaultConfig)
		} else {
			this.#surfaceInstanceDefaultConfig.delete(instanceId)
		}
	}

	#startStopAllConnections(): void {
		for (const surfaceInfo of this.#storage.values()) {
			this.#startStopConnection(surfaceInfo)
		}
	}

	#startStopConnection(connectionInfo: OutboundSurfaceInfo): void {
		const enabled = connectionInfo.enabled && this.#collections.isCollectionEnabled(connectionInfo.collectionId)
		if (enabled === this.#enabledConnectionIds.has(connectionInfo.id)) {
			// No change
			return
		}

		if (enabled) {
			this.#enabledConnectionIds.add(connectionInfo.id)
		} else {
			this.#enabledConnectionIds.delete(connectionInfo.id)
		}

		const surfaceInfoType = connectionInfo.type
		switch (connectionInfo.type) {
			case 'elgato':
				if (connectionInfo.enabled) {
					this.#streamdeckTcpConnectionManager.connectTo(connectionInfo.address, connectionInfo.port)
				} else {
					this.#streamdeckTcpConnectionManager.disconnectFrom(connectionInfo.address, connectionInfo.port)
				}
				break
			case 'plugin':
				this.events.emit(`startStop:${connectionInfo.instanceId}`, connectionInfo)
				break
			default:
				assertNever(connectionInfo)
				this.#logger.error(`Remote surface type "${surfaceInfoType}" is not supported`)
				return
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			discovery: this.#discoveryController.createTrpcRouter(),

			collections: this.#collections.createTrpcRouter(),

			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.events, 'clientInfo', signal)

				// Initial data
				yield { type: 'init', items: Object.fromEntries(self.#storage) } satisfies OutboundSurfacesUpdate

				for await (const [data] of changes) {
					yield data
				}
			}),

			add: publicProcedure
				.input(
					z.object({
						type: z.enum(['elgato']),
						address: z.string(),
						port: z.number().optional(),
						name: z.string().optional(),
					})
				)
				.mutation(async ({ input }) => {
					const { type, address, name } = input

					if (type !== 'elgato') throw new Error(`Surface type "${type}" is not supported`)

					// Ensure port number is defined
					const port = input.port || DEFAULT_TCP_PORT

					// check for duplicate
					const existingAddressAndPort = Array.from(this.#storage.values()).find(
						(surfaceInfo) =>
							surfaceInfo.type === 'elgato' && surfaceInfo.address === address && surfaceInfo.port === port
					)
					if (existingAddressAndPort) throw new Error('Specified address and port is already defined')

					this.#logger.info(`Adding new Remote Streamdeck at ${address}:${port} (${name})`)

					const highestRank =
						Math.max(
							0,
							...Array.from(this.#storage.values())
								.map((c) => (c?.collectionId ? c.sortOrder : null))
								.filter((n) => typeof n === 'number')
						) || 0

					const id = nanoid()
					const newInfo: OutboundSurfaceInfo = {
						id,
						type: 'elgato',
						address,
						enabled: true,
						port,
						displayName: name ?? '',
						sortOrder: highestRank + 1,
						collectionId: null,
					}
					this.#storage.set(id, newInfo)
					this.#dbTable.set(id, newInfo)

					this.events.emit('clientInfo', {
						type: 'add',
						itemId: id,

						info: newInfo,
					})

					this.#startStopConnection(newInfo)

					return id
				}),

			add2: publicProcedure
				.input(
					z.object({
						instanceId: z.string(),
						connectionId: z.string().optional(),
					})
				)
				.mutation(async ({ input }) => {
					this.#logger.info(`Adding new Remote Surface Connection for ${input.instanceId}`)

					// TODO - use connectionId

					const highestRank =
						Math.max(
							0,
							...Array.from(Object.values(this.#storage))
								.map((c) => (c?.collectionId ? c.sortOrder : null))
								.filter((n) => typeof n === 'number')
						) || 0

					const id = nanoid()
					const newInfo: OutboundSurfaceInfo = {
						id,
						type: 'plugin',
						enabled: true,
						displayName: 'New Remote Surface',
						instanceId: input.instanceId,
						config: structuredClone(this.#surfaceInstanceDefaultConfig.get(input.instanceId) ?? {}),
						sortOrder: highestRank + 1,
						collectionId: null,
					}
					this.#storage.set(id, newInfo)
					this.#dbTable.set(id, newInfo)

					this.events.emit('clientInfo', {
						type: 'add',
						itemId: id,

						info: newInfo,
					})

					this.#startStopConnection(newInfo)

					return id
				}),

			remove: publicProcedure
				.input(
					z.object({
						id: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					const { id } = input

					const surfaceInfo = this.#storage.get(id)
					if (!surfaceInfo) return // Not found, pretend all was ok

					this.#storage.delete(id)
					this.#dbTable.delete(id)

					this.events.emit('clientInfo', {
						type: 'remove',
						itemId: id,
					})

					this.#startStopConnection({ ...surfaceInfo, enabled: false }) // Stop the connection
				}),

			setEnabled: publicProcedure
				.input(
					z.object({
						id: z.string(),
						enabled: z.boolean(),
					})
				)
				.mutation(async ({ input }) => {
					const { id, enabled } = input

					const surfaceInfo = this.#storage.get(id)
					if (!surfaceInfo) throw new Error('Surface not found')

					surfaceInfo.enabled = !!enabled
					this.#dbTable.set(id, surfaceInfo)

					// Start/stop the connection
					this.#startStopConnection(surfaceInfo)

					this.events.emit('clientInfo', {
						type: 'add',
						itemId: id,

						info: surfaceInfo,
					})
				}),

			saveConfig: publicProcedure
				.input(
					z.object({
						id: z.string(),
						name: z.string(),
						config: z.record(z.string(), z.any()),
					})
				)
				.mutation(async ({ input }) => {
					const existing = this.#storage.get(input.id)
					if (!existing) throw new Error('Remote Surface not found')

					if (existing.type === 'elgato') {
						existing.displayName = input.name

						this.#dbTable.set(input.id, existing)
					} else {
						// Stop the connection with the old config
						const shouldRestart = existing.enabled && !isEqual(existing.config, input.config)
						if (shouldRestart) {
							this.#startStopConnection({ ...existing, enabled: false })
						}

						existing.displayName = input.name
						existing.config = input.config

						this.#dbTable.set(input.id, existing)

						// Start with the new config
						if (shouldRestart) {
							this.#startStopConnection(existing)
						}
					}

					this.events.emit('clientInfo', {
						type: 'add',
						itemId: input.id,
						info: existing,
					})
				}),

			reorder: publicProcedure
				.input(
					z.object({
						collectionId: z.string().nullable(),
						connectionId: z.string(),
						dropIndex: z.number(),
					})
				)
				.mutation(async ({ input }) => {
					const { collectionId, connectionId, dropIndex } = input

					const thisConnection = this.#storage.get(connectionId)
					if (!thisConnection) return false

					if (!this.#collections.doesCollectionIdExist(collectionId)) return false

					// update the collectionId of the connection being moved if needed
					if (thisConnection.collectionId !== (collectionId ?? null)) {
						thisConnection.collectionId = collectionId

						this.#startStopConnection(thisConnection)

						this.#dbTable.set(connectionId, thisConnection)
						this.events.emit('clientInfo', {
							type: 'add',
							itemId: connectionId,
							info: thisConnection,
						})
					}

					// find all the other connections with the matching collectionId
					const sortedConnections = Array.from(this.#storage.values())
						.filter(
							(connection) =>
								connection.id !== connectionId &&
								((!connection.collectionId && !collectionId) || connection.collectionId === collectionId)
						)
						.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))

					if (dropIndex < 0) {
						// Push the connection to the end of the array
						sortedConnections.push(thisConnection)
					} else {
						// Insert the connection at the drop index
						sortedConnections.splice(dropIndex, 0, thisConnection)
					}

					// update the sort order of the connections in the store, tracking which ones changed
					sortedConnections.forEach((connection, index) => {
						if (connection.sortOrder === index) return // No change

						connection.sortOrder = index
						this.#dbTable.set(connection.id, connection)
						this.events.emit('clientInfo', {
							type: 'add',
							itemId: connection.id,
							info: connection,
						})
					})

					return true
				}),
		})
	}

	getAllEnabledConnectionsForInstance(instanceId: string): ModernOutboundSurfaceInfo[] {
		return Object.values(this.#storage).filter((surfaceInfo) => {
			return (
				surfaceInfo && surfaceInfo.type === 'plugin' && surfaceInfo.instanceId === instanceId && surfaceInfo.enabled
			)
		}) as ModernOutboundSurfaceInfo[]
	}

	removeAllForSurfaceInstance(instanceId: string): void {
		for (const [connectionId, connectionInfo] of Object.entries(this.#storage)) {
			if (!connectionInfo) continue // Safety check

			if (connectionInfo.type !== 'plugin' || connectionInfo.instanceId !== instanceId) continue

			// Cleanup connection
			this.#storage.delete(connectionId)
			this.#dbTable.delete(connectionId)
			this.#startStopConnection(connectionInfo)

			this.events.emit('clientInfo', {
				type: 'remove',
				itemId: connectionId,
			})
		}
	}

	reset(): void {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()

		this.events.emit('clientInfo', {
			type: 'init',
			items: {},
		})

		this.#storage.clear()
		this.#dbTable.clear()
	}

	quit(): void {
		this.#discoveryController.quit()

		this.#streamdeckTcpConnectionManager.disconnectFromAll()
	}
}
