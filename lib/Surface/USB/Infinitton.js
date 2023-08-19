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

import imageRs from '@julusian/image-rs'
import Infinitton from 'infinitton-idisplay'
import { translateRotation } from '../../Resources/Util.js'

class SurfaceUSBInfinitton {
	constructor(ipcWrapper, devicePath) {
		this.ipcWrapper = ipcWrapper

		try {
			this.config = {
				brightness: 100,
				rotation: 0,
			}

			this.ipcWrapper.log('debug', 'Adding infinitton iDisplay USB device', devicePath)

			this.Infinitton = new Infinitton(devicePath)

			const serialNumber = this.Infinitton.device.getDeviceInfo().serialNumber

			this.info = {
				type: 'Infinitton iDisplay device',
				devicePath: devicePath,
				configFields: ['brightness', 'rotation'],
				deviceId: `infinitton:${serialNumber}`,
			}

			this.gridSize = {
				columns: 5,
				rows: 3,
			}

			this.Infinitton.on('down', (keyIndex) => {
				const key = this.reverseButton(keyIndex)
				if (key === undefined) {
					return
				}

				this.ipcWrapper.click(key, true)
			})

			this.Infinitton.on('up', (keyIndex) => {
				const key = this.reverseButton(keyIndex)
				if (key === undefined) {
					return
				}

				this.ipcWrapper.click(key, false)
			})

			this.Infinitton.on('error', (error) => {
				console.error(error)
				this.ipcWrapper.remove()
			})
		} catch (e) {
			if (this.Infinitton) {
				this.Infinitton.close()
			}

			throw e
		}
	}

	async #init() {
		this.ipcWrapper.log('debug', `Infinitton iDisplay detected`)

		// Make sure the first clear happens properly
		this.clearDeck()
	}

	static async create(ipcWrapper, devicePath) {
		const self = new SurfaceUSBInfinitton(ipcWrapper, devicePath)

		await self.#init()

		return self
	}

	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.Infinitton.setBrightness(config.brightness)
		}

		this.config = config
	}

	quit() {
		const dev = this.Infinitton

		if (dev !== undefined) {
			try {
				this.clearDeck()
			} catch (e) {}

			dev.close()
		}
	}

	draw(key, render) {
		key = this.mapButton(key)

		if (key >= 0 && !isNaN(key)) {
			const imagesize = Math.sqrt(render.buffer.length / 4) // TODO: assuming here that the image is square
			const rotation = translateRotation(this.config.rotation)

			try {
				let image = imageRs.ImageTransformer.fromBuffer(
					render.buffer,
					imagesize,
					imagesize,
					imageRs.PixelFormat.Rgba
				).scale(targetSize, targetSize)

				if (rotation !== null) image = image.rotate(rotation)

				const newbuffer = Buffer.from(image.toBufferSync(imageRs.PixelFormat.Rgb))
				this.Infinitton.fillImage(key, newbuffer)
			} catch (e) {
				this.logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		}
		return true
	}

	mapButton(input) {
		const map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
		if (input < 0) {
			return -1
		}

		return parseInt(map[input])
	}

	reverseButton(input) {
		const map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
		for (let pos = 0; pos < map.length; pos++) {
			if (map[input] == pos) return pos
		}

		return
	}

	clearDeck() {
		this.ipcWrapper.log('debug', 'infinitton.prototype.clearDeck()')

		const keysTotal = this.gridSize.columns * this.gridSize.rows
		for (let x = 0; x < keysTotal; x++) {
			this.Infinitton.clearKey(x)
		}
	}
}

export default SurfaceUSBInfinitton
