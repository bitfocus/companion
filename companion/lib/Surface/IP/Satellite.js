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
import { parseColor, parseColorToNumber, transformButtonImage } from '../../Resources/Util.js'
import { convertXYToIndexForPanel, convertPanelIndexToXY } from '../Util.js'
import {
	BrightnessConfigField,
	LegacyRotationConfigField,
	LockConfigFields,
	OffsetConfigFields,
	RotationConfigField,
} from '../CommonConfigFields.js'

/**
 * @typedef {{
 *   deviceId: string
 *   productName: string
 *   path: string
 *   socket: import('net').Socket
 *   gridSize: import('../Util.js').GridSize
 *   streamBitmapSize: number | null
 *   streamColors: string | boolean
 *   streamText: boolean
 *   streamTextStyle: boolean
 *   transferVariables: SatelliteTransferableValue[]
 * }} SatelliteDeviceInfo
 * @typedef {{
 *   id: string
 *   type: 'input' | 'output'
 * 	 name: string
 *   description: string | undefined
 * }} SatelliteTransferableValue
 */

/**
 * @param {boolean} legacyRotation
 * @param {SatelliteDeviceInfo} deviceInfo
 * @return {import('@companion-app/shared/Model/Surfaces.js').CompanionSurfaceConfigField[]}
 */
function generateConfigFields(legacyRotation, deviceInfo) {
	/** @type {import('@companion-app/shared/Model/Surfaces.js').CompanionSurfaceConfigField[]} */
	const fields = [
		...OffsetConfigFields,
		BrightnessConfigField,
		legacyRotation ? LegacyRotationConfigField : RotationConfigField,
		...LockConfigFields,
	]

	for (const variable of deviceInfo.transferVariables) {
		if (variable.type === 'input') {
			fields.push({
				id: `satellite_consumed_${variable.id}`,
				type: 'textinput',
				label: variable.name,
				tooltip: variable.description,
				isExpression: true,
			})
		} else if (variable.type === 'output') {
			fields.push({
				id: `satellite_produced_${variable.id}`,
				type: 'custom-variable',
				label: variable.name,
				tooltip: variable.description,
			})
		}
	}

	return fields
}

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
	 * Whether to stream button colors to the satellite device and which format
	 * can be false, true or 'hex' for hex format, 'rgb' for css rgb format.
	 * @type {string | boolean}
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

		this.gridSize = deviceInfo.gridSize

		this.deviceId = deviceInfo.deviceId

		this.socket = deviceInfo.socket

		this.#streamBitmapSize = deviceInfo.streamBitmapSize
		this.#streamColors = deviceInfo.streamColors
		this.#streamText = deviceInfo.streamText
		this.#streamTextStyle = deviceInfo.streamTextStyle

		/** @type {import('../Handler.js').SurfacePanelInfo} */
		this.info = {
			type: deviceInfo.productName,
			devicePath: deviceInfo.path,
			configFields: generateConfigFields(!!this.#streamBitmapSize, deviceInfo),
			deviceId: deviceInfo.path,
			location: deviceInfo.socket.remoteAddress,
		}

		this.#logger.info(`Adding Satellite device "${this.deviceId}"`)

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
					const newbuffer = await transformButtonImage(
						render,
						this.#config.rotation,
						targetSize,
						targetSize,
						imageRs.PixelFormat.Rgb
					)

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
				let bgcolor = 'rgb(0,0,0)'
				let fgcolor = 'rgb(0,0,0)'
				if (style && style.color !== undefined && style.bgcolor !== undefined) {
					bgcolor = parseColor(style.bgcolor).replaceAll(' ', '')
					fgcolor = parseColor(style.color).replaceAll(' ', '')
				}
				if (this.#streamColors !== 'rgb') {
					bgcolor = '#' + parseColorToNumber(bgcolor).toString(16).padStart(6, '0')
					fgcolor = '#' + parseColorToNumber(fgcolor).toString(16).padStart(6, '0')
				}

				params += ` COLOR=${bgcolor} TEXTCOLOR=${fgcolor}`
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
	 * parses a received key parameter
	 * @param {string} key either as key number in legacy format starting at 0 or in row/column format starting at 0/0 top left
	 * @returns {[x: number, y: number] | null} local key position in [x,y] format or null if input is not valid
	 */
	parseKeyParam(key) {
		const keynum = Number(key)
		const keyParse = key.match(/^\+?(\d+)\/\+?(\d+)$/)

		if (
			Array.isArray(keyParse) &&
			Number(keyParse[1]) < this.gridSize.rows &&
			Number(keyParse[2]) < this.gridSize.columns
		) {
			return [Number(keyParse[2]), Number(keyParse[1])]
		} else if (!isNaN(keynum) && keynum < this.gridSize.columns * this.gridSize.rows && keynum >= 0) {
			return convertPanelIndexToXY(Number(key), this.gridSize)
		} else {
			return null
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
	 * @param {number} column
	 * @param {number} row
	 * @param {boolean} state
	 */
	doButton(column, row, state) {
		this.emit('click', column, row, state)
	}

	/**
	 * Produce a rotation event
	 * @param {number} column
	 * @param {number} row
	 * @param {boolean} direction
	 */
	doRotate(column, row, direction) {
		this.emit('rotate', column, row, direction)
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
