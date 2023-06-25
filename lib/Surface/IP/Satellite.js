/*
 * This file is part of the Companion project
 * Copyright (c) 2019 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
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
import LogController from '../../Log/Controller.js'
import { EventEmitter } from 'events'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import { translateRotation } from '../../Resources/Util.js'
import { convertXYToIndexForPanel } from '../Util.js'

class SurfaceIPSatellite extends EventEmitter {
	logger = LogController.createLogger('Surface/IP/Satellite')

	#streamBitmaps = false
	#streamColors = false
	#streamText = false
	#streamTextStyle = false

	constructor(deviceInfo) {
		super()

		this.info = {
			type: deviceInfo.productName,
			devicepath: deviceInfo.path,
			configFields: ['brightness'],
			keysPerRow: deviceInfo.keysPerRow,
			keysTotal: deviceInfo.keysTotal,
			deviceId: deviceInfo.path,
			location: deviceInfo.socket.remoteAddress,
		}

		this.deviceId = deviceInfo.deviceId

		this.socket = deviceInfo.socket

		this.#streamBitmaps = deviceInfo.streamBitmaps
		this.#streamColors = deviceInfo.streamColors
		this.#streamText = deviceInfo.streamText
		this.#streamTextStyle = deviceInfo.streamTextStyle

		this.logger.info(`Adding Satellite device "${this.deviceId}"`)

		if (this.#streamBitmaps) {
			this.info.configFields.push('rotation')
		}

		this._config = {
			rotation: 0,
			brightness: 100,
		}

		this.write_queue = new ImageWriteQueue(this.logger, async (key, buffer, style) => {
			const targetSize = 72 // Compatibility
			try {
				const imagesize = Math.sqrt(buffer.length / 4) // TODO: assuming here that the image is square
				let image = imageRs.ImageTransformer.fromBuffer(buffer, imagesize, imagesize, imageRs.PixelFormat.Rgba).scale(
					targetSize,
					targetSize
				)

				const rotation = translateRotation(this._config.rotation)
				if (rotation !== null) image = image.rotate(rotation)

				const newbuffer = Buffer.from(await image.toBuffer(imageRs.PixelFormat.Rgb))

				this.#sendDraw(key, newbuffer, style)
			} catch (e) {
				this.logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		})
	}

	quit() {}

	#sendDraw(key, buffer, style) {
		if (this.socket !== undefined) {
			let params = ``
			if (this.#streamColors) {
				// convert color to hex
				const bgcolor = style && typeof style.bgcolor === 'number' ? style.bgcolor : 0
				const color = bgcolor.toString(16).padStart(6, '0')

				params += ` COLOR=#${color}`
			}
			if (this.#streamBitmaps) {
				if (buffer === undefined || buffer.length == 0) {
					this.logger.warn('buffer has invalid size')
				} else {
					params += ` BITMAP=${buffer.toString('base64')}`
				}
			}
			if (this.#streamText) {
				const text = style?.text || ''
				params += ` TEXT=${Buffer.from(text).toString('base64')}`
			}
			if (this.#streamTextStyle) {
				params += ` FONT_SIZE=${style ? style.size : 'auto'}`
			}

			let type = 'BUTTON'
			if (style === 'pageup') {
				type = 'PAGEUP'
			} else if (style === 'pagedown') {
				type = 'PAGEDOWN'
			} else if (style === 'pagenum') {
				type = 'PAGENUM'
			}

			params += ` PRESSED=${style?.pushed ? 'true' : 'false'}`

			this.socket.write(`KEY-STATE DEVICEID=${this.deviceId} KEY=${key} TYPE=${type} ${params}\n`)
		}
	}

	draw(x, y, buffer, style) {
		const key = convertXYToIndexForPanel(x, y, this.info)
		if (key === null) return true

		if (this.#streamBitmaps) {
			// Images need scaling
			this.write_queue.queue(key, buffer, style)
		} else {
			this.#sendDraw(key, undefined, style)
		}

		return true
	}

	doButton(key, state) {
		const xy = convertPanelIndexToXY(key, this.info)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	doRotate(key, direction) {
		const xy = convertPanelIndexToXY(key, this.info)
		if (xy) {
			this.emit('rotate', ...xy, direction)
		}
	}

	clearDeck() {
		this.logger.silly('elgato.prototype.clearDeck()')
		if (this.socket !== undefined) {
			this.socket.write(`KEYS-CLEAR DEVICEID=${this.deviceId}\n`)
		} else {
			this.logger.debug('trying to emit to nonexistaant socket: ', this.deviceId)
		}
	}

	/* elgato-streamdeck functions */

	setConfig(config, force) {
		if ((force || this._config.brightness != config.brightness) && config.brightness !== undefined) {
			this.setBrightness(config.brightness)
		}

		this._config = config
	}

	setBrightness(value) {
		this.logger.silly('brightness: ' + value)
		if (this.socket !== undefined) {
			this.socket.write(`BRIGHTNESS DEVICEID=${this.deviceId} VALUE=${value}\n`)
		}
	}
}

export default SurfaceIPSatellite
