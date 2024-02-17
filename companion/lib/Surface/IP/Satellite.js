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
import { convertXYToIndexForPanel, convertPanelIndexToXY } from '../Util.js'

/**
 * @typedef {{
 *   deviceId: string
 *   productName: string
 *   path: string
 *   socket: import('net').Socket
 *   gridSize: import('../Util.js').GridSize
 *   streamBitmapSize: number | null
 *   streamColors: boolean
 *   streamText: boolean
 *   streamTextStyle: boolean
 * }} SatelliteDeviceInfo
 */

class SurfaceIPSatellite extends EventEmitter {
	#logger = LogController.createLogger('Surface/IP/Satellite')

	/**
	 * @type {ImageWriteQueue}
	 * @access private
	 */
	#writeQueue

	/**
	 * @type {Record<string, any>}
	 * @access private
	 */
	#config

	/**
	 * Dimension of bitmaps to send to the satellite device.
	 * @type {number | null}
	 * @access private
	 */
	#streamBitmapSize
	/**
	 * Whether to stream button colors to the satellite device
	 * @type {boolean}
	 * @access private
	 */
	#streamColors = false
	/**
	 * Whether to stream button text to the satellite device
	 * @type {boolean}
	 * @access private
	 */
	#streamText = false
	/**
	 * Whether to stream button text style to the satellite device
	 * @type {boolean}
	 * @access private
	 */
	#streamTextStyle = false

	/**
	 *
	 * @param {SatelliteDeviceInfo} deviceInfo
	 */
	constructor(deviceInfo) {
		super()

		this.info = {
			type: deviceInfo.productName,
			devicePath: deviceInfo.path,
			configFields: ['brightness'],
			deviceId: deviceInfo.path,
			location: deviceInfo.socket.remoteAddress,
		}

		this.gridSize = deviceInfo.gridSize

		this.deviceId = deviceInfo.deviceId

		this.socket = deviceInfo.socket

		this.#streamBitmapSize = deviceInfo.streamBitmapSize
		this.#streamColors = deviceInfo.streamColors
		this.#streamText = deviceInfo.streamText
		this.#streamTextStyle = deviceInfo.streamTextStyle

		this.#logger.info(`Adding Satellite device "${this.deviceId}"`)

		if (this.#streamBitmapSize) {
			this.info.configFields.push('legacy_rotation')
		}

		this.#config = {
			rotation: 0,
			brightness: 100,
		}

		this.#writeQueue = new ImageWriteQueue(
			this.#logger,
			async (/** @type {number} */ key, /** @type {import('../../Graphics/ImageResult.js').ImageResult} */ render) => {
				const targetSize = this.#streamBitmapSize
				if (!targetSize) return

				try {
					let image = imageRs.ImageTransformer.fromBuffer(
						render.buffer,
						render.bufferWidth,
						render.bufferHeight,
						imageRs.PixelFormat.Rgba
					).scale(targetSize, targetSize)

					const rotation = translateRotation(this.#config.rotation)
					if (rotation !== null) image = image.rotate(rotation)

					const newbuffer = await image.toBuffer(imageRs.PixelFormat.Rgb)

					this.#sendDraw(key, newbuffer, render.style)
				} catch (/** @type {any} */ e) {
					this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
					this.emit('remove')
					return
				}
			}
		)
	}

	quit() {}

	/**
	 * Draw a button
	 * @param {number} key
	 * @param {Buffer | undefined} buffer
	 * @param {*} style
	 * @returns {void}
	 */
	#sendDraw(key, buffer, style) {
		if (this.socket !== undefined) {
			let params = ``
			if (this.#streamColors) {
				// convert color to hex
				const bgcolor = style && typeof style.bgcolor === 'number' ? style.bgcolor : 0
				const color = bgcolor.toString(16).padStart(6, '0')

				params += ` COLOR=#${color}`
			}
			if (this.#streamBitmapSize) {
				if (buffer === undefined || buffer.length == 0) {
					this.#logger.warn('buffer has invalid size')
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

		if (this.#streamBitmapSize) {
			// Images need scaling
			this.#writeQueue.queue(key, render)
		} else {
			this.#sendDraw(key, undefined, render.style)
		}
	}

	/**
	 * Produce a click event
	 * @param {number} key
	 * @param {boolean} state
	 */
	doButton(key, state) {
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
	doRotate(key, direction) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('rotate', ...xy, direction)
		}
	}

	clearDeck() {
		this.#logger.silly('elgato.prototype.clearDeck()')
		if (this.socket !== undefined) {
			this.socket.write(`KEYS-CLEAR DEVICEID=${this.deviceId}\n`)
		} else {
			this.#logger.debug('trying to emit to nonexistaant socket: ', this.deviceId)
		}
	}

	/* elgato-streamdeck functions */

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {Record<string, any>} config
	 * @param {boolean=} force
	 * @returns false when nothing happens
	 */
	setConfig(config, force) {
		if ((force || this.#config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#setBrightness(config.brightness)
		}

		this.#config = config
	}

	/**
	 * Set the brightness
	 * @param {number} value 0-100
	 */
	#setBrightness(value) {
		this.#logger.silly('brightness: ' + value)
		if (this.socket !== undefined) {
			this.socket.write(`BRIGHTNESS DEVICEID=${this.deviceId} VALUE=${value}\n`)
		}
	}
}

export default SurfaceIPSatellite
