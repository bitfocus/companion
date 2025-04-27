import { nanoid } from 'nanoid'
import LogController from '../Log/Controller.js'
import { DEFAULT_TCP_PORT, StreamDeckTcpConnectionManager } from '@elgato-stream-deck/tcp'
import { StreamDeckJpegOptions } from './USB/ElgatoStreamDeck.js'
import type { SurfaceController } from './Controller.js'
import type { DataDatabase } from '../Data/Database.js'
import type { UIHandler, ClientSocket } from '../UI/Handler.js'
import type { OutboundSurfaceInfo, OutboundSurfacesUpdateRemoveOp } from '@companion-app/shared/Model/Surfaces.js'
import { DataStoreTableView } from '../Data/StoreBase.js'

const OutboundSurfacesRoom = 'surfaces:outbound'

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

	/**
	 * The core interface client
	 */
	readonly #io: UIHandler

	#storage: Record<string, OutboundSurfaceInfo> = {}

	#streamdeckTcpConnectionManager = new StreamDeckTcpConnectionManager({
		jpegOptions: StreamDeckJpegOptions,
		autoConnectToSecondaries: true,
	})

	constructor(controller: SurfaceController, db: DataDatabase, io: UIHandler) {
		this.#controller = controller
		this.#dbTable = db.getTableView('surfaces_remote')
		this.#io = io

		// @ts-ignore why is this failing?
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
		// @ts-ignore why is this failing?
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
			try {
				if (surfaceInfo.type === 'elgato') {
					this.#streamdeckTcpConnectionManager.connectTo(surfaceInfo.address, surfaceInfo.port)
				} else {
					throw new Error(`Remote surface type "${surfaceInfo.type}" is not supported`)
				}
			} catch (e) {
				this.#logger.error(`Unable to setup remote surface at ${surfaceInfo.address}:${surfaceInfo.port}: ${e}`)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('surfaces:outbound:subscribe', async () => {
			client.join(OutboundSurfacesRoom)

			return this.#storage
		})
		client.onPromise('surfaces:outbound:unsubscribe', async () => {
			client.leave(OutboundSurfacesRoom)
		})
		client.onPromise('surfaces:outbound:add', async (type, address, port, name) => {
			if (type !== 'elgato') throw new Error(`Surface type "${type}" is not supported`)

			// Ensure port number is defined
			if (!port) port = DEFAULT_TCP_PORT

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
				port,
				displayName: name ?? '',
			}
			this.#storage[id] = newInfo
			this.#dbTable.set(id, newInfo)

			this.#io.emitToRoom(OutboundSurfacesRoom, 'surfaces:outbound:update', [
				{
					type: 'add',
					itemId: id,

					info: newInfo,
				},
			])

			this.#streamdeckTcpConnectionManager.connectTo(address, port)

			return id
		})

		client.onPromise('surfaces:outbound:remove', async (id) => {
			const surfaceInfo = this.#storage[id]
			if (!surfaceInfo) return // Not found, pretend all was ok

			delete this.#storage[id]
			this.#dbTable.delete(id)

			this.#io.emitToRoom(OutboundSurfacesRoom, 'surfaces:outbound:update', [
				{
					type: 'remove',
					itemId: id,
				},
			])

			this.#streamdeckTcpConnectionManager.disconnectFrom(surfaceInfo.address, surfaceInfo.port)
		})

		client.onPromise('surfaces:outbound:set-name', async (id, name) => {
			const surfaceInfo = this.#storage[id]
			if (!surfaceInfo) throw new Error('Surface not found')

			surfaceInfo.displayName = name ?? ''
			this.#dbTable.set(id, surfaceInfo)

			this.#io.emitToRoom(OutboundSurfacesRoom, 'surfaces:outbound:update', [
				{
					type: 'add',
					itemId: id,

					info: surfaceInfo,
				},
			])
		})
	}

	reset(): void {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()

		const ops: OutboundSurfacesUpdateRemoveOp[] = Object.keys(this.#storage).map((id) => ({
			type: 'remove',
			itemId: id,
		}))
		if (ops.length > 0) {
			this.#io.emitToRoom(OutboundSurfacesRoom, 'surfaces:outbound:update', ops)
		}

		this.#storage = {}
		this.#dbTable.clear()
	}

	quit(): void {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()
	}
}
