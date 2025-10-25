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

export class SurfaceOutboundController {
	/**
	 * The logger for this class
	 */
	readonly #logger = LogController.createLogger('SurfaceOutboundController')

	readonly #controller: SurfaceController

	/**
	 * The core database library
	 */
	readonly #dbTable: DataStoreTableView<Record<string, OutboundSurfaceInfo>>

	#storage: Record<string, OutboundSurfaceInfo> = {}

	readonly #updateEvents = new EventEmitter<{ info: [update: OutboundSurfacesUpdate] }>()

	#streamdeckTcpConnectionManager = new StreamDeckTcpConnectionManager({
		jpegOptions: StreamDeckJpegOptions,
		autoConnectToSecondaries: true,
	})

	constructor(controller: SurfaceController, db: DataDatabase) {
		this.#controller = controller
		this.#dbTable = db.getTableView('surfaces_remote')

		this.#updateEvents.setMaxListeners(0)

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

	/**
	 * Initialize the module, loading the configuration from the db
	 * @access public
	 */
	init(): void {
		this.#storage = this.#dbTable.all()

		for (const surfaceInfo of Object.values(this.#storage)) {
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

	#startStopConnection(surfaceInfo: OutboundSurfaceInfo): void {
		if (surfaceInfo.type !== 'elgato') {
			this.#logger.error(`Remote surface type "${surfaceInfo.type}" is not supported`)
			return
		}

		if (surfaceInfo.enabled) {
			this.#streamdeckTcpConnectionManager.connectTo(surfaceInfo.address, surfaceInfo.port)
		} else {
			this.#streamdeckTcpConnectionManager.disconnectFrom(surfaceInfo.address, surfaceInfo.port)
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			watch: publicProcedure.subscription(async function* ({ signal }) {
				const changes = toIterable(self.#updateEvents, 'info', signal)

				// Initial data
				yield { type: 'init', items: self.#storage } satisfies OutboundSurfacesUpdate

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
					const existingAddressAndPort = Object.values(this.#storage).find(
						(surfaceInfo) => surfaceInfo.address === address && surfaceInfo.port === port
					)
					if (existingAddressAndPort) throw new Error('Specified address and port is already defined')

					this.#logger.info(`Adding new Remote Streamdeck at ${address}:${port} (${name})`)

					const id = nanoid()
					const newInfo: OutboundSurfaceInfo = {
						id,
						type: 'elgato',
						address,
						enabled: true,
						port,
						displayName: name ?? '',
					}
					this.#storage[id] = newInfo
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

					const surfaceInfo = this.#storage[id]
					if (!surfaceInfo) return // Not found, pretend all was ok

					delete this.#storage[id]
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

					const surfaceInfo = this.#storage[id]
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

					const surfaceInfo = this.#storage[id]
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
		})
	}

	reset(): void {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()

		this.#updateEvents.emit('info', {
			type: 'init',
			items: {},
		})

		this.#storage = {}
		this.#dbTable.clear()
	}

	quit(): void {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()
	}
}
