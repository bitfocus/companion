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
const setTimeoutPromise = util.promisify(setTimeout)

class SurfaceUSBElgatoStreamDeck extends EventEmitter {
	constructor(devicepath, streamDeck) {
		super()

		this.logger = LogController.createLogger(`Surface/USB/ElgatoStreamdeck/${devicepath}`)

		this.config = {
			brightness: 100,
			rotation: 0,
		}

		this.logger.debug(`Adding elgato-streamdeck USB device: ${devicepath}`)

		this.streamDeck = streamDeck

		this.info = {
			type: `Elgato ${this.streamDeck.PRODUCT_NAME}`,
			devicepath: devicepath,
			configFields: ['brightness', 'rotation'],
			keysPerRow: this.streamDeck.KEY_COLUMNS,
			keysTotal: this.streamDeck.NUM_KEYS,
			deviceId: undefined, // set in #init()
		}

		this.write_queue = new ImageWriteQueue(this.logger, async (key, buffer) => {
			let newbuffer = buffer
			const targetSize = this.streamDeck.ICON_SIZE
			if (targetSize === 0) {
				return
			} else {
				try {
					let imagesize = Math.sqrt(buffer.length/3) // TODO: assuming here that the image is square
					let image = imageRs.ImageTransformer.fromBuffer(buffer, imagesize, imagesize, imageRs.PixelFormat.Rgb)

					//if (targetSize !== 72) image = image.scale(targetSize, targetSize)
					image.scale(targetSize, targetSize)

					const rotation = translateRotation(this.config.rotation)
					if (rotation !== null) image = image.rotate(rotation)

					newbuffer = Buffer.from(await image.toBuffer(imageRs.PixelFormat.Rgb))
				} catch (e) {
					this.logger.debug(`scale image failed: ${e}`)
					this.emit('remove')
					return
				}
			}

			const maxAttempts = 3
			for (let attempts = 1; attempts <= maxAttempts; attempts++) {
				try {
					await this.streamDeck.fillKeyBuffer(key, newbuffer)
					return
				} catch (e) {
					if (attempts == maxAttempts) {
						this.logger.debug(`fillImage failed after ${attempts} attempts: ${e}`)
						this.emit('remove')
						return
					}
					await setTimeoutPromise(20)
				}
			}
		})

		this.streamDeck.on('error', (error) => {
			this.logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.streamDeck.on('down', (keyIndex) => {
			this.emit('click', keyIndex, true)
		})

		this.streamDeck.on('up', (keyIndex) => {
			this.emit('click', keyIndex, false)
		})

		if (this.streamDeck.MODEL === DeviceModelId.PLUS) {
			this.info.keysTotal += 8

			const encoderOffset = 12
			this.streamDeck.on('rotateLeft', (encoderIndex) => {
				this.emit('rotate', encoderOffset + encoderIndex, false)
			})
			this.streamDeck.on('rotateRight', (encoderIndex) => {
				this.emit('rotate', encoderOffset + encoderIndex, true)
			})
			this.streamDeck.on('encoderDown', (encoderIndex) => {
				this.emit('click', encoderOffset + encoderIndex, true)
			})
			this.streamDeck.on('encoderUp', (encoderIndex) => {
				this.emit('click', encoderOffset + encoderIndex, false)
			})

			const lcdOffset = 8
			const lcdPress = (segmentIndex) => {
				this.emit('click', lcdOffset + segmentIndex, true)

				setTimeout(() => {
					this.emit('click', lcdOffset + segmentIndex, false)
				}, 20)
			}
			this.streamDeck.on('lcdShortPress', lcdPress)
			this.streamDeck.on('lcdLongPress', lcdPress)

			this.lcdWriteQueue = new ImageWriteQueue(this.logger, async (key, buffer) => {
				const rotation = translateRotation(this.config.rotation)

				let newbuffer
				try {
					let image = imageRs.ImageTransformer.fromBuffer(buffer, 72, 72, imageRs.PixelFormat.Rgb).scale(100, 100)

					const rotation = translateRotation(this.config.rotation)
					if (rotation !== null) image = image.rotate(rotation)

					newbuffer = Buffer.from(await image.toBuffer(imageRs.PixelFormat.Rgb))
				} catch (e) {
					this.logger.debug(`scale image failed: ${e}`)
					this.emit('remove')
					return
				}

				const maxAttempts = 3
				for (let attempts = 1; attempts <= maxAttempts; attempts++) {
					try {
						const x = key * 200 + 50
						await this.streamDeck.fillLcdRegion(x, 0, newbuffer, {
							format: 'rgb',
							width: 100,
							height: 100,
						})
						return
					} catch (e) {
						if (attempts == maxAttempts) {
							this.logger.error(`fillImage failed after ${attempts}: ${e}`)
							this.emit('remove')
							return
						}
						await setTimeoutPromise(20)
					}
				}
			})
		}
	}

	async #init() {
		const serialnumber = await this.streamDeck.getSerialNumber()
		this.info.deviceId = `streamdeck:${serialnumber}`

		this.logger.debug(`Elgato ${this.streamDeck.PRODUCT_NAME} detected`)

		// Make sure the first clear happens properly
		await this.streamDeck.clearPanel()
	}

	static async create(devicepath) {
		const streamDeck = await openStreamDeck(devicepath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})

		try {
			const self = new SurfaceUSBElgatoStreamDeck(devicepath, streamDeck)

			await self.#init()

			return self
		} catch (e) {
			await streamDeck.close().catch(() => null)

			throw e
		}
	}

	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.streamDeck.setBrightness(config.brightness).catch((e) => {
				this.logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit() {
		this.streamDeck
			.resetToLogo()
			.catch((e) => {
				this.logger.debug(`Clear deck failed: ${e}`)
			})
			.then(() => {
				//close after the clear has been sent
				this.streamDeck.close()
			})
	}

	clearDeck() {
		this.logger.silly('elgato_base.prototype.clearDeck()')

		this.streamDeck.clearPanel().catch((e) => {
			this.logger.debug(`Clear deck failed: ${e}`)
		})
	}

	draw(key, buffer, style) {
		if (key >= 0 && key < this.streamDeck.NUM_KEYS) {
			this.write_queue.queue(key, buffer)
		}

		const segmentIndex = key - this.streamDeck.NUM_KEYS
		if (segmentIndex >= 0 && segmentIndex < this.streamDeck.KEY_COLUMNS) {
			this.lcdWriteQueue.queue(segmentIndex, buffer)
		}

		return true
	}
}

export default SurfaceUSBElgatoStreamDeck
