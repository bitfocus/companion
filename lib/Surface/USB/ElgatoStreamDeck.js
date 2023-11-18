/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

import { EventEmitter } from 'events'
import { DeviceModelId, openStreamDeck } from '@elgato-stream-deck/node'
import util from 'util'
import imageRs from '@julusian/image-rs'
import LogController from '../../Log/Controller.js'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import { translateRotation } from '../../Resources/Util.js'
import { convertXYToIndexForPanel, convertPanelIndexToXY } from '../Util.js'
const setTimeoutPromise = util.promisify(setTimeout)

class SurfaceUSBElgatoStreamDeck extends EventEmitter {
	/**
	 * @type {import('winston').Logger}
	 * @access private
	 * @readonly
	 */
	#logger

	/**
	 * @type {Record<string, any>}
	 * @access private
	 */
	config = {}

	/**
	 * Xkeys panel
	 * @type {import('@elgato-stream-deck/node').StreamDeck}
	 * @access private
	 * @readonly
	 */
	#streamDeck

	/**
	 * @param {string} devicePath
	 * @param {import('@elgato-stream-deck/node').StreamDeck} streamDeck
	 */
	constructor(devicePath, streamDeck) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/ElgatoStreamdeck/${devicePath}`)

		this.config = {
			brightness: 100,
			rotation: 0,
		}

		this.#logger.debug(`Adding elgato-streamdeck USB device: ${devicePath}`)

		this.#streamDeck = streamDeck

		this.info = {
			type: `Elgato ${this.#streamDeck.PRODUCT_NAME}`,
			devicePath: devicePath,
			configFields: ['brightness', 'legacy_rotation'],
			deviceId: '', // set in #init()
		}

		this.gridSize = {
			columns: this.#streamDeck.KEY_COLUMNS,
			rows: this.#streamDeck.KEY_ROWS,
		}
		if (this.#streamDeck.MODEL === DeviceModelId.PLUS) {
			this.gridSize.rows += 2
		}

		this.write_queue = new ImageWriteQueue(
			this.#logger,
			async (/** @type {number} */ key, /** @type {import('../../Graphics/ImageResult.js').ImageResult} */ render) => {
				let newbuffer = render.buffer
				const targetSize = this.#streamDeck.ICON_SIZE
				if (targetSize === 0) {
					return
				} else {
					try {
						let image = imageRs.ImageTransformer.fromBuffer(
							render.buffer,
							render.bufferWidth,
							render.bufferHeight,
							imageRs.PixelFormat.Rgba
						).scale(targetSize, targetSize)

						const rotation = translateRotation(this.config.rotation)
						if (rotation !== null) image = image.rotate(rotation)

						newbuffer = await image.toBuffer(imageRs.PixelFormat.Rgb)
					} catch (/** @type {any} */ e) {
						this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
						this.emit('remove')
						return
					}
				}

				const maxAttempts = 3
				for (let attempts = 1; attempts <= maxAttempts; attempts++) {
					try {
						await this.#streamDeck.fillKeyBuffer(key, newbuffer)
						return
					} catch (e) {
						if (attempts == maxAttempts) {
							this.#logger.debug(`fillImage failed after ${attempts} attempts: ${e}`)
							this.emit('remove')
							return
						}
						await setTimeoutPromise(20)
					}
				}
			}
		)

		this.#streamDeck.on('error', (error) => {
			this.#logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.#streamDeck.on('down', (keyIndex) => {
			this.#emitClick(keyIndex, true)
		})

		this.#streamDeck.on('up', (keyIndex) => {
			this.#emitClick(keyIndex, false)
		})

		if (this.#streamDeck.MODEL === DeviceModelId.PLUS) {
			const encoderOffset = 12
			this.#streamDeck.on('rotateLeft', (encoderIndex) => {
				this.#emitRotate(encoderOffset + encoderIndex, false)
			})
			this.#streamDeck.on('rotateRight', (encoderIndex) => {
				this.#emitRotate(encoderOffset + encoderIndex, true)
			})
			this.#streamDeck.on('encoderDown', (encoderIndex) => {
				this.#emitClick(encoderOffset + encoderIndex, true)
			})
			this.#streamDeck.on('encoderUp', (encoderIndex) => {
				this.#emitClick(encoderOffset + encoderIndex, false)
			})

			const lcdOffset = 8
			const lcdPress = (/** @type {number} */ segmentIndex) => {
				this.#emitClick(lcdOffset + segmentIndex, true)

				setTimeout(() => {
					this.#emitClick(lcdOffset + segmentIndex, false)
				}, 20)
			}
			this.#streamDeck.on('lcdShortPress', lcdPress)
			this.#streamDeck.on('lcdLongPress', lcdPress)

			this.lcdWriteQueue = new ImageWriteQueue(
				this.#logger,
				async (
					/** @type {number} */ key,
					/** @type {import('../../Graphics/ImageResult.js').ImageResult} */ render
				) => {
					let newbuffer
					try {
						let image = imageRs.ImageTransformer.fromBuffer(
							render.buffer,
							render.bufferWidth,
							render.bufferHeight,
							imageRs.PixelFormat.Rgba
						).scale(100, 100)

						const rotation = translateRotation(this.config.rotation)
						if (rotation !== null) image = image.rotate(rotation)

						newbuffer = await image.toBuffer(imageRs.PixelFormat.Rgb)
					} catch (e) {
						this.#logger.debug(`scale image failed: ${e}`)
						this.emit('remove')
						return
					}

					const maxAttempts = 3
					for (let attempts = 1; attempts <= maxAttempts; attempts++) {
						try {
							const x = key * 216.666 + 25
							await this.#streamDeck.fillLcdRegion(x, 0, newbuffer, {
								format: 'rgb',
								width: 100,
								height: 100,
							})
							return
						} catch (e) {
							if (attempts == maxAttempts) {
								this.#logger.error(`fillImage failed after ${attempts}: ${e}`)
								this.emit('remove')
								return
							}
							await setTimeoutPromise(20)
						}
					}
				}
			)
		}
	}

	/**
	 * Produce a click event
	 * @param {number} key
	 * @param {boolean} state
	 */
	#emitClick(key, state) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	/**
	 * Produce a rotation event
	 * @param {number} key
	 * @param {boolean} direction
	 */
	#emitRotate(key, direction) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('rotate', ...xy, direction)
		}
	}

	async #init() {
		const serialNumber = await this.#streamDeck.getSerialNumber()
		this.info.deviceId = `streamdeck:${serialNumber}`

		this.#logger.debug(`Elgato ${this.#streamDeck.PRODUCT_NAME} detected`)

		// Make sure the first clear happens properly
		await this.#streamDeck.clearPanel()
	}

	/**
	 * Open a streamdeck
	 * @param {string} devicePath
	 * @returns {Promise<SurfaceUSBElgatoStreamDeck>}
	 */
	static async create(devicePath) {
		const streamDeck = await openStreamDeck(devicePath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})

		try {
			const self = new SurfaceUSBElgatoStreamDeck(devicePath, streamDeck)

			await self.#init()

			return self
		} catch (e) {
			await streamDeck.close().catch(() => null)

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {Record<string, any>} config
	 * @param {boolean=} force
	 * @returns false when nothing happens
	 */
	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#streamDeck.setBrightness(config.brightness).catch((e) => {
				this.#logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit() {
		this.#streamDeck
			.resetToLogo()
			.catch((e) => {
				this.#logger.debug(`Clear deck failed: ${e}`)
			})
			.then(() => {
				//close after the clear has been sent
				this.#streamDeck.close()
			})
	}

	clearDeck() {
		this.#logger.silly('elgato_base.prototype.clearDeck()')

		this.#streamDeck.clearPanel().catch((e) => {
			this.#logger.debug(`Clear deck failed: ${e}`)
		})
	}

	/**
	 * Draw a button
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	draw(x, y, render) {
		const key = convertXYToIndexForPanel(x, y, this.gridSize)
		if (key === null) return

		if (key >= 0 && key < this.#streamDeck.NUM_KEYS) {
			this.write_queue.queue(key, render)
		}

		const segmentIndex = key - this.#streamDeck.NUM_KEYS
		if (this.lcdWriteQueue && segmentIndex >= 0 && segmentIndex < this.#streamDeck.KEY_COLUMNS) {
			this.lcdWriteQueue.queue(segmentIndex, render)
		}
	}
}

export default SurfaceUSBElgatoStreamDeck
