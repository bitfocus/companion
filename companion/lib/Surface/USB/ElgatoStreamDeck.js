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
import { transformButtonImage } from '../../Resources/Util.js'
import { colorToRgb } from './Util.js'
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

		this.#streamDeck = streamDeck

		this.#logger.debug(`Adding elgato-streamdeck ${this.#streamDeck.PRODUCT_NAME} USB device: ${devicePath}`)

		this.info = {
			type: `Elgato ${this.#streamDeck.PRODUCT_NAME}`,
			devicePath: devicePath,
			configFields: ['brightness', 'legacy_rotation'],
			deviceId: '', // set in #init()
		}

		const allRowValues = this.#streamDeck.CONTROLS.map((control) => control.row)
		const allColumnValues = this.#streamDeck.CONTROLS.map((button) => button.column)

		const gridSpan = {
			// minRow: Math.min(...allRowValues),
			maxRow: Math.max(...allRowValues),
			// minCol: Math.min(...allColumnValues),
			maxCol: Math.max(...allColumnValues),
		}

		this.gridSize = {
			columns: gridSpan.maxCol + 1,
			rows: gridSpan.maxRow + 1,
		}

		this.write_queue = new ImageWriteQueue(
			this.#logger,
			async (
				/** @type {string} */ _id,
				/** @type {number} */ x,
				/** @type {number} */ y,
				/** @type {import('../../Graphics/ImageResult.js').ImageResult} */ render
			) => {
				const control = this.#streamDeck.CONTROLS.find((control) => {
					if (control.row !== y) return false

					if (control.column === x) return true

					if (control.type === 'lcd-segment' && x >= control.column && x < control.column + control.columnSpan)
						return true

					return false
				})
				if (!control) return

				if (control.type === 'button') {
					if (control.feedbackType === 'lcd') {
						let newbuffer = render.buffer
						if (control.pixelSize.width === 0 || control.pixelSize.height === 0) {
							return
						} else {
							try {
								newbuffer = await transformButtonImage(
									render,
									this.config.rotation,
									control.pixelSize.width,
									control.pixelSize.height,
									imageRs.PixelFormat.Rgb
								)
							} catch (/** @type {any} */ e) {
								this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
								this.emit('remove')
								return
							}
						}

						const maxAttempts = 3
						for (let attempts = 1; attempts <= maxAttempts; attempts++) {
							try {
								await this.#streamDeck.fillKeyBuffer(control.index, newbuffer)
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
					} else if (control.feedbackType === 'rgb') {
						const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }
						this.#streamDeck.fillKeyColor(control.index, color.r, color.g, color.b).catch((e) => {
							this.#logger.debug(`color failed: ${e}`)
						})
					}
				} else if (control.type === 'lcd-segment' && control.drawRegions) {
					const drawColumn = x - control.column

					const columnWidth = control.pixelSize.width / control.columnSpan
					let drawX = drawColumn * columnWidth
					if (this.#streamDeck.MODEL === DeviceModelId.PLUS) {
						// Position aligned with the buttons/encoders
						drawX = drawColumn * 216.666 + 25
					}

					const targetSize = control.pixelSize.height

					let newbuffer
					try {
						newbuffer = await transformButtonImage(
							render,
							this.config.rotation,
							targetSize,
							targetSize,
							imageRs.PixelFormat.Rgb
						)
					} catch (e) {
						this.#logger.debug(`scale image failed: ${e}`)
						this.emit('remove')
						return
					}

					const maxAttempts = 3
					for (let attempts = 1; attempts <= maxAttempts; attempts++) {
						try {
							await this.#streamDeck.fillLcdRegion(control.id, drawX, 0, newbuffer, {
								format: 'rgb',
								width: targetSize,
								height: targetSize,
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
			}
		)

		this.#streamDeck.on('error', (error) => {
			this.#logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.#streamDeck.on('down', (control) => {
			this.emit('click', control.column, control.row, true)
		})

		this.#streamDeck.on('up', (control) => {
			this.emit('click', control.column, control.row, false)
		})

		this.#streamDeck.on('rotate', (control, amount) => {
			this.emit('rotate', control.column, control.row, amount > 0)
		})

		const lcdPress = (
			/** @type {import('@elgato-stream-deck/node').StreamDeckLcdSegmentControlDefinition} */ control,
			/** @type {import('@elgato-stream-deck/node').LcdPosition} */ position
		) => {
			const columnOffset = Math.floor((position.x / control.pixelSize.width) * control.columnSpan)

			this.emit('click', control.column + columnOffset, control.row, true)

			setTimeout(() => {
				this.emit('click', control.column + columnOffset, control.row, false)
			}, 20)
		}
		this.#streamDeck.on('lcdShortPress', lcdPress)
		this.#streamDeck.on('lcdLongPress', lcdPress)
	}

	async #init() {
		const serialNumber = await this.#streamDeck.getSerialNumber()
		this.info.deviceId = `streamdeck:${serialNumber}`

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

			/** @type {any} */
			let errorDuringInit = null
			const tmpErrorHandler = (/** @type {any} */ error) => {
				errorDuringInit = errorDuringInit || error
			}

			// Ensure that any hid error during the init call don't cause a crash
			self.on('error', tmpErrorHandler)

			await self.#init()

			if (errorDuringInit) throw errorDuringInit
			self.off('error', tmpErrorHandler)

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
		this.write_queue.queue(`${x}_${y}`, x, y, render)
	}
}

export default SurfaceUSBElgatoStreamDeck
