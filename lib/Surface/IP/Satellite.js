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
import { rotateBuffer } from '../../Resources/Util.js'
import debug0 from '../../Log/Debug.js'
import { EventEmitter } from 'events'

class SurfaceIPSatellite extends EventEmitter {
	debug = debug0('satellite-server', 'lib/Surface/IP/Satellite')

	#streamBitmaps = false
	#streamColors = false
	#streamText = false

	constructor(deviceInfo) {
		super()

		this.info = {
			type: deviceInfo.productName,
			devicepath: deviceInfo.path,
			configFields: ['brightness'],
			keysPerRow: deviceInfo.keysPerRow,
			keysTotal: deviceInfo.keysTotal,
			serialnumber: deviceInfo.path,
		}

		this.deviceId = deviceInfo.deviceId

		this.socket = deviceInfo.socket

		this.#streamBitmaps = deviceInfo.streamBitmaps
		this.#streamColors = deviceInfo.streamColors
		this.#streamText = deviceInfo.streamText

		this.debug('Adding Satellite device')

		if (this.#streamBitmaps) {
			this.info.configFields.push('rotation')
		}

		this._config = {
			rotation: 0,
			brightness: 100,
		}
	}

	quit() {}

	draw(key, buffer, style) {
		if (this.socket !== undefined) {
			let params = ``
			if (this.#streamColors) {
				// convert color to hex
				const bgcolor = style && typeof style.bgcolor === 'number' ? style.bgcolor : 0
				const color = bgcolor.toString(16).padStart(6, '0')

				params += ` COLOR=#${color}`
			}
			if (this.#streamBitmaps) {
				if (buffer === undefined || buffer.length != 15552) {
					this.debug('buffer was not 15552, but ', buffer.length)
				} else {
					params += ` BITMAP=${rotateBuffer(buffer, this.config.rotation).toString('base64')}`
				}
			}
			if (this.#streamText) {
				const text = style?.text || ''
				params += ` TEXT=${Buffer.from(text).toString('base64')}`
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

		return true
	}

	doButton(key, state) {
		this.emit('click', key, state)
	}

	clearDeck() {
		this.debug('elgato.prototype.clearDeck()')
		if (this.socket !== undefined) {
			this.socket.write(`KEYS-CLEAR DEVICEID=${this.deviceId}\n`)
		} else {
			this.debug('trying to emit to nonexistaant socket: ', this.id)
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
		this.debug('brightness: ' + value)
		if (this.socket !== undefined) {
			this.socket.write(`BRIGHTNESS DEVICEID=${this.deviceId} VALUE=${value}\n`)
		}
	}
}

export default SurfaceIPSatellite
