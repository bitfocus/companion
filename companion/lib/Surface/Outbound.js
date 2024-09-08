import { nanoid } from 'nanoid'
import LogController from '../Log/Controller.js'
import { DEFAULT_TCP_PORT, StreamDeckTcpConnectionManager } from '@elgato-stream-deck/tcp'
import { StreamDeckJpegOptions } from './USB/ElgatoStreamDeck.js'

const OutboundSurfacesRoom = 'surfaces:outbound'

export class SurfaceOutboundController {
	/**
	 * The logger for this class
	 * @type {import('winston').Logger}
	 * @access protected
	 */
	#logger = LogController.createLogger('SurfaceOutboundController')

	/**
	 * @type {import('./Controller.js').default}
	 * @readonly
	 */
	#controller

	/**
	 * The core database library
	 * @type {import('../Data/Database.js').default}
	 * @access protected
	 * @readonly
	 */
	#db

	/**
	 * The core interface client
	 * @type {import('../UI/Handler.js').default}
	 * @access protected
	 * @readonly
	 */
	#io

	/**
	 * @type {Record<string, import('@companion-app/shared/Model/Surfaces.js').OutboundSurfaceInfo>}
	 */
	#storage = {}

	#streamdeckTcpConnectionManager = new StreamDeckTcpConnectionManager({
		jpegOptions: StreamDeckJpegOptions,
		autoConnectToSecondaries: true,
	})

	/**
	 * @type {Record<string, import('@companion-app/shared/Model/Surfaces.js').OutboundSurfaceInfo>}
	 */
	get storage() {
		return this.#storage
	}

	/**
	 *
	 * @param {import('./Controller.js').default} controller
	 * @param {import('../Data/Database.js').default} db
	 * @param {import('../UI/Handler.js').default} io
	 */
	constructor(controller, db, io) {
		this.#controller = controller
		this.#db = db
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

	#saveToDb() {
		this.#db.setKey('outbound_surfaces', this.#storage)
	}

	/**
	 * Initialize the module, loading the configuration from the db
	 * @access public
	 */
	init() {
		this.#storage = this.#db.getKey('outbound_surfaces', {})

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
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
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
			/** @type {import('@companion-app/shared/Model/Surfaces.js').OutboundSurfaceInfo} */
			const newInfo = {
				id,
				type: 'elgato',
				address,
				port,
				displayName: name ?? '',
			}
			this.#storage[id] = newInfo
			this.#saveToDb()

			this.#io.emitToRoom(OutboundSurfacesRoom, 'surfaces:outbound:update', [
				{
					type: 'add',
					itemId: id,

					info: newInfo,
				},
			])
			setImmediate(() => this.#controller.updateDevicesList())

			this.#streamdeckTcpConnectionManager.connectTo(address, port)

			return id
		})

		client.onPromise('surfaces:outbound:remove', async (id) => {
			const surfaceInfo = this.#storage[id]
			if (!surfaceInfo) return // Not found, pretend all was ok

			delete this.#storage[id]
			this.#saveToDb()

			this.#io.emitToRoom(OutboundSurfacesRoom, 'surfaces:outbound:update', [
				{
					type: 'remove',
					itemId: id,
				},
			])
			setImmediate(() => this.#controller.updateDevicesList())

			this.#streamdeckTcpConnectionManager.disconnectFrom(surfaceInfo.address, surfaceInfo.port)
		})

		client.onPromise('surfaces:outbound:set-name', async (id, name) => {
			const surfaceInfo = this.#storage[id]
			if (!surfaceInfo) throw new Error('Surface not found')

			surfaceInfo.displayName = name ?? ''
			this.#saveToDb()

			this.#io.emitToRoom(OutboundSurfacesRoom, 'surfaces:outbound:update', [
				{
					type: 'add',
					itemId: id,

					info: surfaceInfo,
				},
			])
			setImmediate(() => this.#controller.updateDevicesList())
		})
	}

	quit() {
		this.#streamdeckTcpConnectionManager.disconnectFromAll()
	}
}
