import { nanoid } from 'nanoid'
import LogController from '../Log/Controller.js'
import { DEFAULT_TCP_PORT, StreamDeckTcpConnectionManager } from '@elgato-stream-deck/tcp'
import { StreamDeckJpegOptions } from './USB/ElgatoStreamDeck.js'
import type { SurfaceController } from './Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import type { OutboundSurfaceInfo, OutboundSurfacesUpdate } from '@companion-app/shared/Model/Surfaces.js'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import { EventEmitter } from 'node:events'
import { OutboundSurfaceCollections } from './OutboundCollections.js'

export class SurfaceOutboundController {
	/**
	 * The logger for this class
	 */
	readonly #logger = LogController.createLogger('SurfaceOutboundController')

	readonly #controller: SurfaceController
	readonly #collections: OutboundSurfaceCollections

	/**
	 * The core database library
	 */
	readonly #dbTable: DataStoreTableView<Record<string, OutboundSurfaceInfo>>

	#storage = new Map<string, OutboundSurfaceInfo>()

	readonly #updateEvents = new EventEmitter<{ info: [update: OutboundSurfacesUpdate] }>()
	readonly #enabledConnectionIds = new Set<string>()

	#streamdeckTcpConnectionManager = new StreamDeckTcpConnectionManager({
		jpegOptions: StreamDeckJpegOptions,
		autoConnectToSecondaries: true,
	})

	constructor(controller: SurfaceController, db: DataDatabase) {
		this.#controller = controller
		this.#dbTable = db.getTableView('surfaces_remote')

		this.#updateEvents.setMaxListeners(0)

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

				this.#updateEvents.emit('info', {
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
				this.#logger.info(`Skipping disabled remote surface at ${surfaceInfo.address}:${surfaceInfo.port}`)
				continue
			}

			try {
				this.#startStopConnection(surfaceInfo)
			} catch (e) {
				this.#logger.error(`Unable to setup remote surface at ${surfaceInfo.address}:${surfaceInfo.port}: ${e}`)
			}
		}
	}

	#startStopAllConnections(): void {
		for (const surfaceInfo of this.#storage.values()) {
			this.#startStopConnection(surfaceInfo)
		}
	}

	#startStopConnection(surfaceInfo: OutboundSurfaceInfo): void {
		if (surfaceInfo.type !== 'elgato') {
			this.#logger.error(`Remote surface type "${surfaceInfo.type}" is not supported`)
			return
		}

		const enabled = surfaceInfo.enabled && this.#collections.isCollectionEnabled(surfaceInfo.collectionId)
		if (enabled === this.#enabledConnectionIds.has(surfaceInfo.id)) {
			// No change
			return
		}

		if (enabled) {
			this.#enabledConnectionIds.add(surfaceInfo.id)
			this.#streamdeckTcpConnectionManager.connectTo(surfaceInfo.address, surfaceInfo.port)
		} else {
			this.#enabledConnectionIds.delete(surfaceInfo.id)
			this.#streamdeckTcpConnectionManager.disconnectFrom(surfaceInfo.address, surfaceInfo.port)
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			collections: this.#collections.createTrpcRouter(),

			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#updateEvents, 'info', signal)

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
						(surfaceInfo) => surfaceInfo.address === address && surfaceInfo.port === port
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

					this.#updateEvents.emit('info', {
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

					this.#updateEvents.emit('info', {
						type: 'remove',
						itemId: id,
					})

					this.#startStopConnection({ ...surfaceInfo, enabled: false }) // Stop the connection
				}),

			setName: publicProcedure
				.input(
					z.object({
						id: z.string(),
						name: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					const { id, name } = input

					const surfaceInfo = this.#storage.get(id)
					if (!surfaceInfo) throw new Error('Surface not found')

					surfaceInfo.displayName = name
					this.#dbTable.set(id, surfaceInfo)

					this.#updateEvents.emit('info', {
						type: 'add',
						itemId: id,

						info: surfaceInfo,
					})
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

					this.#updateEvents.emit('info', {
						type: 'add',
						itemId: id,

						info: surfaceInfo,
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
						this.#updateEvents.emit('info', {
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
						this.#updateEvents.emit('info', {
							type: 'add',
							itemId: connection.id,
							info: connection,
						})
					})

					return true
				}),
		})
	}

	reset(): void {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()

		this.#updateEvents.emit('info', {
			type: 'init',
			items: {},
		})

		this.#storage.clear()
		this.#dbTable.clear()
	}

	quit(): void {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()
	}
}
