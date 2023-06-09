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
	constructor(ipcWrapper, devicepath) {
		this.ipcWrapper = ipcWrapper

		this.config = {
			brightness: 100,
			rotation: 0,
		}

		this.ipcWrapper.log('debug', 'Adding infinitton iDisplay USB device', devicepath)

		this.Infinitton = new Infinitton(devicepath)

		const serialnumber = this.Infinitton.device.getDeviceInfo().serialNumber

		this.info = {
			type: 'Infinitton iDisplay device',
			devicepath: devicepath,
			configFields: ['brightness', 'rotation'],
			keysPerRow: 5,
			keysTotal: 15,
			deviceId: `infinitton:${serialnumber}`,
		}

		this.ipcWrapper.log('debug', 'Infinitton detected')

		this.Infinitton.on('down', (keyIndex) => {
			let key = this.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}

			this.ipcWrapper.click(key, true)
		})

		this.Infinitton.on('up', (keyIndex) => {
			let key = this.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}

			this.ipcWrapper.click(key, false)
		})

		this.Infinitton.on('error', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})

		this.clearDeck()
	}

	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.Infinitton.setBrightness(config.brightness)
		}

		this.config = config
	}

	quit() {
		let sd = this.Infinitton

		if (sd !== undefined) {
			try {
				this.clearDeck()
			} catch (e) {}

			// Find the actual infinitton driver, to talk to the device directly
			if (sd.device === undefined && sd.Infinitton !== undefined) {
				sd = sd.Infinitton
			}

			// If an actual infinitton is connected, disconnect
			if (sd.device !== undefined) {
				sd.device.close()
			}
		}
	}

	draw(key, buffer, style) {
		key = this.mapButton(key)

		if (key >= 0 && !isNaN(key)) {
			let imagesize = Math.sqrt(buffer.length / 4) // TODO: assuming here that the image is square
			const rotation = translateRotation(this.config.rotation)

			try {
				let newbuffer = buffer
				let image = imageRs.ImageTransformer.fromBuffer(buffer, imagesize, imagesize, imageRs.PixelFormat.Rgba)
					.scale(targetSize, targetSize)

				if (rotation !== null) image = image.rotate(rotation)

				newbuffer = Buffer.from(image.toBufferSync(imageRs.PixelFormat.Rgb))
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

		for (let x = 0; x < this.info.keysTotal; x++) {
			this.Infinitton.clearKey(x)
		}
	}
}

export default SurfaceUSBInfinitton
