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

import { DeviceModelId, openStreamDeck } from '@elgato-stream-deck/node'
import util from 'util'
import sharp from 'sharp'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import { rotateBuffer } from '../../Resources/Util.js'
import { throwStatement } from '@babel/types'
const setTimeoutPromise = util.promisify(setTimeout)

class SurfaceUSBElgatoStreamDeck {
	constructor(ipcWrapper, devicepath) {
		try {
			this.ipcWrapper = ipcWrapper

			this.config = {
				brightness: 100,
				rotation: 0,
			}

			this.ipcWrapper.log('debug', `Adding elgato_streamdeck USB device: ${devicepath}`)

			this.streamDeck = openStreamDeck(devicepath, {
				// useOriginalKeyOrder: true,
				jpegOptions: {
					quality: 95,
					subsampling: 1, // 422
				},
			})

			this.info = {
				type: `Elgato ${this.streamDeck.PRODUCT_NAME}`,
				devicepath: devicepath,
				configFields: ['brightness', 'rotation'],
				keysPerRow: this.streamDeck.KEY_COLUMNS,
				keysTotal: this.streamDeck.NUM_KEYS,
				deviceId: undefined, // set in #init()
			}

			this.write_queue = new ImageWriteQueue(this.ipcWrapper, async (key, buffer) => {
				let newbuffer = buffer
				const targetSize = this.streamDeck.ICON_SIZE
				if (targetSize === 0) {
					return
				} else if (targetSize !== 72) {
					try {
						newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
							.resize(targetSize, targetSize)
							.raw()
							.toBuffer()
					} catch (e) {
						this.ipcWrapper.log('debug', `scale image failed: ${e}`)
						this.ipcWrapper.remove()
						return
					}
				}

				const maxAttempts = 3
				for (let attempts = 1; attempts <= maxAttempts; attempts++) {
					try {
						this.streamDeck.fillKeyBuffer(key, newbuffer)
						return
					} catch (e) {
						if (attempts == maxAttempts) {
							this.ipcWrapper.log('debug', `fillImage failed after ${attempts} attempts: ${e}`)
							this.ipcWrapper.remove()
							return
						}
						await setTimeoutPromise(20)
					}
				}
			})

			this.streamDeck.on('error', (error) => {
				console.error(error)
				this.ipcWrapper.remove()
			})

			this.streamDeck.on('down', (keyIndex) => {
				this.ipcWrapper.click(keyIndex, true)
			})

			this.streamDeck.on('up', (keyIndex) => {
				this.ipcWrapper.click(keyIndex, false)
			})

			if (this.streamDeck.MODEL === DeviceModelId.PLUS) {
				this.info.keysTotal += 8

				const encoderOffset = 12
				this.streamDeck.on('rotateLeft', (encoderIndex) => {
					this.ipcWrapper.rotate(encoderOffset + encoderIndex, false)
				})
				this.streamDeck.on('rotateRight', (encoderIndex) => {
					this.ipcWrapper.rotate(encoderOffset + encoderIndex, true)
				})
				this.streamDeck.on('encoderDown', (encoderIndex) => {
					this.ipcWrapper.click(encoderOffset + encoderIndex, true)
				})
				this.streamDeck.on('encoderUp', (encoderIndex) => {
					this.ipcWrapper.click(encoderOffset + encoderIndex, false)
				})

				const lcdOffset = 8
				const lcdPress = (segmentIndex) => {
					this.ipcWrapper.click(lcdOffset + segmentIndex, true)

					setTimeout(() => {
						this.ipcWrapper.click(lcdOffset + segmentIndex, false)
					}, 20)
				}
				this.streamDeck.on('lcdShortPress', lcdPress)
				this.streamDeck.on('lcdLongPress', lcdPress)

				this.lcdWriteQueue = new ImageWriteQueue(this.ipcWrapper, async (key, buffer) => {
					let newbuffer
					try {
						newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
							.resize(100, 100)
							.raw()
							.toBuffer()
					} catch (e) {
						this.ipcWrapper.log('debug', `scale image failed: ${e}`)
						this.ipcWrapper.remove()
						return
					}

					const maxAttempts = 3
					for (let attempts = 1; attempts <= maxAttempts; attempts++) {
						try {
							const x = key * 200 + 50
							this.streamDeck.fillLcdRegion(x, 0, newbuffer, {
								format: 'rgb',
								width: 100,
								height: 100,
							})
							return
						} catch (e) {
							if (attempts == maxAttempts) {
								this.ipcWrapper.log('error', `fillImage failed after ${attempts}: ${e}`)
								this.ipcWrapper.remove()
								return
							}
							await setTimeoutPromise(20)
						}
					}
				})
			}
		} catch (e) {
			if (this.streamDeck) {
				this.streamDeck.close()
			}

			throw e
		}
	}

	async #init() {
		const serialnumber = await this.streamDeck.getSerialNumber()
		this.info.deviceId = `streamdeck:${serialnumber}`

		this.ipcWrapper.log('debug', `Elgato ${this.streamDeck.PRODUCT_NAME} detected`)

		// Make sure the first clear happens properly
		await this.streamDeck.clearPanel()
	}

	static async create(ipcWrapper, devicepath) {
		const self = new SurfaceUSBElgatoStreamDeck(ipcWrapper, devicepath)

		await self.#init()

		return self
	}

	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.streamDeck.setBrightness(config.brightness).catch((e) => {
				this.ipcWrapper.log('debug', `Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit() {
		this.streamDeck
			.resetToLogo()
			.catch((e) => {
				this.ipcWrapper.log('debug', `Clear deck failed: ${e}`)
			})
			.then(() => {
				//close after the clear has been sent
				this.streamDeck.close()
			})
	}

	clearDeck() {
		this.ipcWrapper.log('silly', 'elgato_base.prototype.clearDeck()')

		this.streamDeck.clearPanel().catch((e) => {
			this.ipcWrapper.log('debug', `Clear deck failed: ${e}`)
		})
	}

	draw(key, buffer, style) {
		buffer = rotateBuffer(buffer, this.config.rotation)

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
