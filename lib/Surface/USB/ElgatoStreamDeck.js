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

import { openStreamDeck } from '@elgato-stream-deck/node'
import util from 'util'
import sharp from 'sharp'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import { rotateBuffer } from '../../Resources/Util.js'
import createDebug from '../../Log/Debug.js'
const setTimeoutPromise = util.promisify(setTimeout)

class SurfaceUSBElgatoStreamDeck {
	debug = createDebug('stream-deck', 'lib/Surface/USB/ElgatoStreamDeck')

	constructor(ipcWrapper, devicepath) {
		this.ipcWrapper = ipcWrapper

		this.config = {
			brightness: 100,
			rotation: 0,
		}

		this.debug(`Adding elgato_streamdeck USB device`, devicepath)

		this.streamDeck = openStreamDeck(devicepath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})

		this.info = {
			type: `Elgato ${this.streamDeck.PRODUCT_NAME} device`,
			devicepath: devicepath,
			configFields: ['brightness', 'rotation'],
			keysPerRow: this.streamDeck.KEY_COLUMNS,
			keysTotal: this.streamDeck.NUM_KEYS,
			serialnumber: undefined, // set in #init()
		}

		this.write_queue = new ImageWriteQueue(async (key, buffer) => {
			let newbuffer = buffer
			const targetSize = this.streamDeck.ICON_SIZE
			if (targetSize !== 72) {
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
	}

	async #init() {
		this.info.serialnumber = await this.streamDeck.getSerialNumber()

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
		try {
			this.clearDeck()
		} catch (e) {}

		this.streamDeck.close()
	}

	clearDeck() {
		this.ipcWrapper.debug('elgato_base.prototype.clearDeck()')

		this.streamDeck.clearPanel().catch((e) => {
			this.ipcWrapper.log('debug', `Clear deck failed: ${e}`)
		})
	}

	draw(key, buffer, style) {
		buffer = rotateBuffer(buffer, this.config.rotation)

		this.write_queue.queue(key, buffer)

		return true
	}
}

export default SurfaceUSBElgatoStreamDeck
