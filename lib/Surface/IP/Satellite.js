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
import SurfaceBase from '../Base.js'
import debug0 from 'debug'

class SurfaceIPSatellite extends SurfaceBase {
	debug = debug0('lib/Surface/IP/Satellite')

	#streamBitmaps = false
	#streamColors = false
	#streamText = false

	constructor(system, deviceInfo) {
		super()
		this.system = system

		this.type = deviceInfo.productName
		this.deviceId = deviceInfo.deviceId
		this.serialnumber = deviceInfo.path
		this.id = deviceInfo.path
		this.keysPerRow = deviceInfo.keysPerRow
		this.keysTotal = deviceInfo.keysTotal

		this.socket = deviceInfo.socket

		this.#streamBitmaps = deviceInfo.streamBitmaps
		this.#streamColors = deviceInfo.streamColors
		this.#streamText = deviceInfo.streamText

		this.debug('Adding Satellite device')

		this.devicepath = deviceInfo.path
		this.config = ['brightness']
		if (this.#streamBitmaps) {
			this.config.push('orientation')
		}

		this._config = {
			rotation: 0,
			brightness: 100,
		}

		this.system.on(deviceInfo.path + '_button', (key, state) => {
			this.doButton(key, state)
		})

		setImmediate(() => {
			this.system.emit('device_ready', this.devicepath)
		})
	}

	begin() {
		this.setBrightness(this._config.brightness)
	}

	quit() {
		this.system.removeAllListeners(this.devicepath + '_button')
	}

	draw(key, buffer, style) {
		const keyIndex2 = this.toDeviceKey(key)
		if (keyIndex2 === -1) return

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
					params += ` BITMAP=${this.handleBuffer(buffer).toString('base64')}`
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

			this.socket.write(`KEY-STATE DEVICEID=${this.deviceId} KEY=${keyIndex2} TYPE=${type} ${params}\n`)
		}

		return true
	}

	doButton(key, state) {
		const keyIndex2 = this.toGlobalKey(key)

		this.system.emit('device_click', this.devicepath, keyIndex2, state)
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

	setConfig(config, cb) {
		let redraw = false

		if (this.#streamBitmaps && this._config.rotation != config.rotation && config.rotation !== undefined) {
			redraw = true
		}

		if (this._config.brightness != config.brightness && config.brightness !== undefined) {
			this.setBrightness(config.brightness)
		}

		this._config = config

		cb(redraw)
	}

	setBrightness(value) {
		this.debug('brightness: ' + value)
		if (this.socket !== undefined) {
			this.socket.write(`BRIGHTNESS DEVICEID=${this.deviceId} VALUE=${value}\n`)
		}
	}
}

export default SurfaceIPSatellite
