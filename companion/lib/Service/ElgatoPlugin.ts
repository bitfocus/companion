import LogController from '../Log/Controller.js'
import { ServiceBase } from './Base.js'
import { WebSocketServer, WebSocket } from 'ws'
import { oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import { EventEmitter } from 'events'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import { transformButtonImage } from '../Resources/Util.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { Registry } from '../Registry.js'

/**
 * Class providing the Elgato Plugin service.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.3.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ServiceElgatoPlugin extends ServiceBase {
	#server: WebSocketServer | undefined
	#client: ServiceElgatoPluginSocket | undefined

	constructor(registry: Registry) {
		super(registry, 'Service/ElgatoPlugin', 'elgato_plugin_enable', null)

		this.port = 28492

		this.graphics.on('button_drawn', (location, render) => {
			if (!this.#client) return

			const currentPageNumber = this.page.getPageNumber(this.#client.currentPageId)

			// Send dynamic page
			if (location.pageNumber === currentPageNumber) {
				this.#handleButtonDrawn(
					{
						...location,
						pageNumber: null,
					},
					render
				)
			}

			// Send specific page
			this.#handleButtonDrawn(location, render)
		})
		this.surfaces.on('surface_page', (surfaceId, newPageId) => {
			if (this.#client && surfaceId === 'plugin') {
				this.#client.currentPageId = newPageId

				this.#redrawAllDynamicButtons()
			}
		})

		this.init()
	}

	/**
	 * Close the socket before deleting it
	 */
	protected close(): void {
		if (this.#server) {
			this.logger.info('Shutting down')

			for (const client of this.#server.clients) {
				client.terminate()
			}

			this.#server.close()
			this.#server = undefined
		}
	}

	#handleButtonDrawn(location: { pageNumber: number | null; row: number; column: number }, render: ImageResult): void {
		if (location.pageNumber !== null) location.pageNumber = Number(location.pageNumber)

		if (this.#client && this.#client.buttonListeners) {
			const id = `${location.pageNumber}_${location.column}_${location.row}`
			if (this.#client.buttonListeners.has(id)) {
				this.#client.fillImage(
					id,
					{
						page: location.pageNumber,
						column: location.column,
						row: location.row,
					},
					render
				)
			}

			// Backwards compatible mode
			const cols = 8
			const rows = 4
			if (location.column >= 0 && location.row >= 0 && location.column < cols && location.row < rows) {
				const bank = location.column + location.row * cols
				const id = `${location.pageNumber}_${bank}`
				if (this.#client.buttonListeners.has(id)) {
					this.#client.fillImage(
						id,
						{
							page: location.pageNumber,
							bank: bank,
							keyIndex: bank,
						},
						render
					)
				}
			}
		}
	}

	#redrawAllDynamicButtons(): void {
		if (!this.#client || !this.#client.supportsCoordinates) return

		const currentPageNumber = this.page.getPageNumber(this.#client.currentPageId)

		for (const listenerId of this.#client.buttonListeners) {
			if (!listenerId.startsWith('null_')) continue

			const [_page, column, row] = listenerId.split('_').map((i) => Number(i))
			if (isNaN(column) || isNaN(row)) continue

			this.#handleButtonDrawn(
				{
					pageNumber: null,
					column: column,
					row: row,
				},
				this.graphics.getCachedRenderOrGeneratePlaceholder({
					pageNumber: currentPageNumber ?? 0,
					column: column,
					row: row,
				})
			)
		}
	}

	/**
	 * Setup the socket for v2 API
	 */
	#initAPI2(socket: ServiceElgatoPluginSocket): void {
		this.logger.silly('init api v2')
		socket.once('new_device', (/** @type {string | Record<string, any>} */ info) => {
			try {
				// Process the parameter, backwards compatible
				const remoteId = typeof info === 'string' ? info : info.id
				const clientInfo = typeof info === 'string' ? { id: remoteId } : info

				this.logger.silly('add device: ' + socket.remoteAddress, remoteId)

				// Use ip right now, since the pluginUUID is new on each boot and makes Companion
				// forget all settings for the device. (page and orientation)
				const id = 'elgato_plugin-' + socket.remoteAddress

				socket.supportsPng = !!clientInfo.supportsPng
				socket.supportsCoordinates = !!clientInfo.supportsCoordinates

				this.surfaces.addElgatoPluginDevice(id, socket)

				socket.currentPageId = this.surfaces.devicePageGet('plugin') || this.page.getFirstPageId()

				socket.apireply('new_device', {
					result: true,

					// confirm support for opt-in features
					supportsPng: socket.supportsPng,
					supportsCoordinates: socket.supportsCoordinates,
				})

				this.#client = socket

				socket.on('close', () => {
					this.surfaces.removeDevice(id)
					socket.removeAllListeners('keyup')
					socket.removeAllListeners('keydown')
					this.#client = undefined
				})
			} catch (e: any) {
				this.logger.error(`Elgato plugin add failed: ${e?.message ?? e}`)
				socket.close()
			}
		})

		socket.on('request_button', (args) => {
			this.logger.silly('request_button: ', args)

			if ('column' in args || 'row' in args) {
				socket.buttonListeners.add(`${args.page}_${args.column}_${args.row}`)

				socket.apireply('request_button', { result: 'ok' })

				const currentPageNumber = this.page.getPageNumber(socket.currentPageId)

				const fromLocation = {
					pageNumber: args.page === null ? (currentPageNumber ?? 0) : Number(args.page),
					column: Number(args.column),
					row: Number(args.row),
				}
				const displayLocation = {
					pageNumber: args.page === null ? null : Number(args.page),
					column: Number(args.column),
					row: Number(args.row),
				}

				this.#handleButtonDrawn(displayLocation, this.graphics.getCachedRenderOrGeneratePlaceholder(fromLocation))
			} else {
				socket.buttonListeners.add(`${args.page}_${args.bank}`)

				socket.apireply('request_button', { result: 'ok' })

				const xy = oldBankIndexToXY(Number(args.bank) + 1)
				if (xy) {
					const location = {
						pageNumber: Number(args.page),
						column: xy[0],
						row: xy[1],
					}

					this.#handleButtonDrawn(location, this.graphics.getCachedRenderOrGeneratePlaceholder(location))
				}
			}
		})

		socket.on('unrequest_button', (args) => {
			this.logger.silly('unrequest_button: ', args)

			if ('column' in args || 'row' in args) {
				socket.buttonListeners.delete(`${args.page}_${args.column}_${args.row}`)
			} else {
				socket.buttonListeners.delete(`${args.page}_${args.bank}`)
			}

			socket.apireply('request_button', { result: 'ok' })
		})
	}

	/**
	 * Setup the socket processing and rig the appropriate version processing
	 */
	#initSocket(socket: ServiceElgatoPluginSocket): void {
		socket.on('version', (args) => {
			if (args.version > 2) {
				// Newer than current api version
				socket.apireply('version', { version: 2, error: 'cannot continue' })
				socket.close()
			} else if (args.version === 1) {
				// We don't support v1 anymore
				socket.apireply('version', { version: 2, error: 'no longer supported' })
				socket.close()
			} else {
				socket.apireply('version', { version: 2 })

				this.#initAPI2(socket)
			}
		})
	}

	/**
	 * Start the service if it is not already running
	 */
	protected listen(): void {
		if (this.portConfig) {
			this.port = this.userconfig.getKey(this.portConfig)
		}

		if (this.#server === undefined) {
			try {
				this.#server = new WebSocketServer({
					port: this.port,
				})

				this.#server.on('connection', this.#processIncoming.bind(this))

				this.#server.on('error', (err) => {
					this.logger.error(`Error: ${err.message}`)
				})

				this.currentState = true
				this.logger.info('Listening on port ' + this.port)
			} catch (e: any) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	/**
	 * Set up a new socket connection
	 */
	#processIncoming(socket: WebSocket): void {
		// @ts-ignore
		const remoteAddress = socket.remoteAddress

		this.logger.silly(`New connection from ${remoteAddress}`)

		const wrappedSocket = new ServiceElgatoPluginSocket(socket, remoteAddress)

		this.#initSocket(wrappedSocket)

		socket.on('message', (message) => {
			try {
				let data = JSON.parse(message.toString())
				wrappedSocket.emit(data.command, data.arguments)
				//this.logger.silly('emitting command ' + data.command);
			} catch (e) {
				this.logger.warn('protocol error:', e)
			}
		})

		socket.on('close', () => {
			this.logger.silly(`Connection from ${remoteAddress} disconnected`)
		})
	}
}

export class ServiceElgatoPluginSocket extends EventEmitter {
	readonly #logger = LogController.createLogger('Surface/ElgatoPlugin/Socket')

	readonly socket: WebSocket
	readonly remoteAddress: string

	readonly buttonListeners = new Set<string>()

	/**
	 *
	 */
	supportsPng = false

	/**
	 * Whether the connected plugin supports using coordinates.
	 * This also means that it will require explicit subscribing to each dynamic button
	 */
	supportsCoordinates = false

	/**
	 * The current page number of the surface
	 */
	currentPageId: string = ''

	readonly #write_queue: ImageWriteQueue<string | number, [Record<string, number | null>, ImageResult]>

	constructor(socket: WebSocket, remoteAddress: string) {
		super()

		this.socket = socket
		this.remoteAddress = remoteAddress

		this.#write_queue = new ImageWriteQueue(this.#logger, async (_id, partial, render) => {
			const targetSize = 72 // Compatibility
			try {
				const newbuffer = await transformButtonImage(render, null, targetSize, targetSize, imageRs.PixelFormat.Rgb)

				this.apicommand('fillImage', { ...partial, data: newbuffer })
			} catch (e: any) {
				this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		})
	}

	fillImage(id: string | number, partial: Record<string, number | null>, render: ImageResult): void {
		if (this.supportsPng) {
			this.apicommand('fillImage', {
				...partial,
				png: true,
				data: render.asDataUrl,
			})
		} else {
			this.#write_queue.queue(id, partial, render)
		}
	}

	/**
	 * Package and send a command
	 * @param command - the command
	 * @param args - arguments for the command
	 */
	apicommand(command: string, args: object): void {
		this.socket.send(JSON.stringify({ command: command, arguments: args }))
	}

	/**
	 * Package and send a response
	 * @param command - the command
	 * @param args - arguments for the command
	 */
	apireply(command: string, args: object): void {
		this.socket.send(JSON.stringify({ response: command, arguments: args }))
	}

	close(): void {
		this.socket.close()
	}
}
