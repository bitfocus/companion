import LogController from '../Log/Controller.js'
import ServiceBase from './Base.js'
import { WebSocketServer, WebSocket } from 'ws'
import { oldBankIndexToXY } from '../Shared/ControlId.js'
import { EventEmitter } from 'events'
import ImageWriteQueue from '../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import { translateRotation } from '../Resources/Util.js'

/**
 * Class providing the Elgato Plugin service.
 *
 * @extends ServiceBase
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
class ServiceElgatoPlugin extends ServiceBase {
	/**
	 * @type {WebSocketServer | undefined}
	 * @access protected
	 */
	server = undefined

	/**
	 * The port to open the socket with.  Default: <code>28492</code>
	 * @type {number}
	 * @access protected
	 */
	port = 28492

	/**
	 * @param {import('../Registry.js').default} registry - the application's core
	 */
	constructor(registry) {
		super(registry, 'elgato-plugin', 'Service/ElgatoPlugin', 'elgato_plugin_enable', null)

		this.graphics.on('button_drawn', this.#handleButtonDrawn.bind(this))

		this.init()
	}

	/**
	 * Close the socket before deleting it
	 * @access protected
	 */
	close() {
		if (this.server) {
			this.logger.info('Shutting down')

			for (const client of this.server.clients) {
				client.terminate()
			}

			this.server.close()
			delete this.server
		}
	}

	/**
	 * @param {import('../Resources/Util.js').ControlLocation} location
	 * @param {import('../Graphics/ImageResult.js').ImageResult} render
	 */
	#handleButtonDrawn(location, render) {
		location.pageNumber = Number(location.pageNumber)

		if (this.client && this.client.buttonListeners) {
			const id = `${location.pageNumber}_${location.column}_${location.row}`
			if (this.client.buttonListeners.has(id)) {
				this.client.fillImage(
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
				if (this.client.buttonListeners.has(id)) {
					this.client.fillImage(
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

	/**
	 * Setup the socket for v2 API
	 * @param {ServiceElgatoPluginSocket} socket
	 */
	#initAPI2(socket) {
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

				this.surfaces.addElgatoPluginDevice(id, socket)

				socket.apireply('new_device', { result: true })

				this.client = socket

				socket.on('close', () => {
					this.surfaces.removeDevice(id)
					socket.removeAllListeners('keyup')
					socket.removeAllListeners('keydown')
					delete this.client
				})
			} catch (/** @type {any} */ e) {
				this.logger.error(`Elgato plugin add failed: ${e?.message ?? e}`)
				socket.close()
			}
		})

		socket.on('request_button', (args) => {
			this.logger.silly('request_button: ', args)

			if ('column' in args || 'row' in args) {
				socket.buttonListeners.add(`${args.page}_${args.column}_${args.row}`)

				socket.apireply('request_button', { result: 'ok' })

				const location = {
					pageNumber: Number(args.page),
					column: Number(args.column),
					row: Number(args.row),
				}

				this.#handleButtonDrawn(location, this.graphics.getCachedRenderOrGeneratePlaceholder(location))
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
	 * @param {ServiceElgatoPluginSocket} socket
	 */
	#initSocket(socket) {
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
	 * @access protected
	 */
	listen() {
		if (this.portConfig) {
			this.port = this.userconfig.getKey(this.portConfig)
		}

		if (this.server === undefined) {
			try {
				this.server = new WebSocketServer({
					port: this.port,
				})

				this.server.on('connection', this.#processIncoming.bind(this))

				this.currentState = true
				this.logger.info('Listening on port ' + this.port)
			} catch (/** @type {any} */ e) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	/**
	 * Set up a new socket connection
	 * @param {WebSocket} socket
	 * @returns {void}
	 */
	#processIncoming(socket) {
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

export default ServiceElgatoPlugin

export class ServiceElgatoPluginSocket extends EventEmitter {
	#logger = LogController.createLogger('Surface/ElgatoPlugin/Socket')

	/**
	 * @type {WebSocket}
	 * @readonly
	 */
	socket

	/**
	 * @type {string}
	 * @readonly
	 */
	remoteAddress

	/**
	 * @type {Set<string>}
	 * @readonly
	 */
	buttonListeners = new Set()

	/**
	 *
	 * @type {boolean}
	 * @access public
	 */
	supportsPng = false

	/**
	 * @type {import('../Surface/Util.js').SurfaceRotation | 90 | -90 | 180 | 0 | null}
	 * @access public
	 */
	rotation = 0

	/**
	 * @type {ImageWriteQueue}
	 * @access private
	 */
	#write_queue

	/**
	 * @param {WebSocket} socket
	 * @param {string }remoteAddress
	 */
	constructor(socket, remoteAddress) {
		super()

		this.socket = socket
		this.remoteAddress = remoteAddress

		this.#write_queue = new ImageWriteQueue(
			this.#logger,
			async (
				/** @type {string | number} */ _id,
				/** @type {Record<string, number>} */ partial,
				/** @type {import('../Graphics/ImageResult.js').ImageResult} */ render
			) => {
				const targetSize = 72 // Compatibility
				try {
					let image = imageRs.ImageTransformer.fromBuffer(
						render.buffer,
						render.bufferWidth,
						render.bufferHeight,
						imageRs.PixelFormat.Rgba
					).scale(targetSize, targetSize)

					const rotation = translateRotation(this.rotation)
					if (rotation !== null) image = image.rotate(rotation)

					const newbuffer = await image.toBuffer(imageRs.PixelFormat.Rgb)

					this.apicommand('fillImage', { ...partial, data: newbuffer })
				} catch (/** @type {any} */ e) {
					this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
					this.emit('remove')
					return
				}
			}
		)
	}

	/**
	 *
	 * @param {string | number} id
	 * @param {Record<string, number>} partial
	 * @param {import('../Graphics/ImageResult.js').ImageResult} render
	 */
	fillImage(id, partial, render) {
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
	 * @param {string} command - the command
	 * @param {Object} args - arguments for the command
	 */
	apicommand(command, args) {
		this.socket.send(JSON.stringify({ command: command, arguments: args }))
	}

	/**
	 * Package and send a response
	 * @param {string} command - the command
	 * @param {Object} args - arguments for the command
	 */
	apireply(command, args) {
		this.socket.send(JSON.stringify({ response: command, arguments: args }))
	}

	close() {
		this.socket.close()
	}
}
