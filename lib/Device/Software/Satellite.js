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

var DeviceBase = require('../Base')
var debug = require('debug')('Device/Software/Satellite')
var Protocol = require('../../Resources/SatelliteProtocol')
var Image = require('../../Graphics/Image')

class DeviceSoftwareSatellite extends DeviceBase {
	static deviceType = 'Satellite device'

	constructor(system, devicepath, deviceInfo) {
		super()

		this.system = system
		this.buttonState = []

		this.type = 'Satellite device'
		this.serialnumber = devicepath
		this.id = devicepath
		this.keysPerRow = deviceInfo.keysPerRow ? deviceInfo.keysPerRow : 8
		this.keysTotal = deviceInfo.keysTotal ? deviceInfo.keysTotal : 32

		debug('Adding Satellite device')

		this.devicepath = devicepath
		;(this.deviceType = 'Satellite device'), (this.config = ['orientation', 'brightness', 'page'])

		this._config = {
			rotation: 0,
			brightness: 100,
		}

		debug('Waiting for satellite startup: ', devicepath + '_satellite_startup')
		this.system.once(devicepath + '_satellite_startup', (socket, deviceId) => {
			this.socket = socket
			this.deviceId = deviceId

			this.system.emit('device_ready', devicepath)
		})

		this.system.on(devicepath + '_button', (key, state) => {
			this.doButton(key, state)
		})

		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false,
			}
		}

		this.clearImage = new Image(72, 72)
	}

	begin() {
		this.setBrightness(this._config.brightness)
	}

	quit() {
		this.system.removeAllListeners(this.devicepath + '_button')
	}

	draw(key, buffer) {
		if (buffer === undefined || buffer.length != 15552) {
			debug('buffer was not 15552, but ', buffer.length)
			return false
		}

		buffer = this.handleBuffer(buffer)

		this.fillImage(key, buffer)

		return true
	}

	doButton(key, state) {
		const keyIndex2 = this.toGlobalKey(key)

		if (this.buttonState[keyIndex2]) {
			this.buttonState[keyIndex2].pressed = state
			this.system.emit('device_press', this.devicepath, keyIndex2, state, this.buttonState)
		}
	}

	clearDeck() {
		debug('elgato.prototype.clearDeck()')

		for (var x = 0; x < this.keysTotal; x++) {
			this.clearKey(x)
		}
	}

	setConfig(config) {
		if (this._config.rotation != config.rotation && config.rotation !== undefined) {
			this._config.rotation = config.rotation
			this.system.emit('device_redraw', this.devicepath)
		}

		if (this._config.brightness != config.brightness && config.brightness !== undefined) {
			this._config.brightness = config.brightness
			this.setBrightness(config.brightness)
		}

		if (this.deviceHandler) {
			// Custom override, page should have been inside the deviceconfig object
			if (config.page !== undefined) {
				this.deviceHandler.page = config.page
				this.deviceHandler.updatePagedevice()
			}
		}

		this._config = config

		if (this.deviceHandler) {
			this.deviceconfig = config
			this.deviceHandler.updatedConfig()
		}
	}

	fillImage(keyIndex, imageBuffer) {
		const keyIndex2 = this.toDeviceKey(keyIndex)
		if (keyIndex2 === -1) {
			return
		}

		if (imageBuffer.length !== 15552) {
			throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
		}

		if (this.socket !== undefined) {
			var buf = Protocol.SCMD_DRAW7272_PARSER.serialize({
				deviceId: this.deviceId,
				keyIndex: keyIndex2,
				image: imageBuffer,
			})

			Protocol.sendPacket(this.socket, Protocol.SCMD_DRAW7272, buf)
		}
	}

	setBrightness(value) {
		debug('brightness: ' + value)

		if (this.socket !== undefined) {
			var buf = Protocol.SCMD_BRIGHTNESS_PARSER.serialize({
				deviceId: this.deviceId,
				percent: value,
			})

			Protocol.sendPacket(this.socket, Protocol.SCMD_BRIGHTNESS, buf)
		}
	}

	clearKey(keyIndex) {
		if (this.socket !== undefined) {
			debug('Key index: ' + keyIndex)
			var buf = Protocol.SCMD_DRAW7272_PARSER.serialize({
				deviceId: this.deviceId,
				keyIndex: keyIndex,
				image: this.clearImage,
			})
			Protocol.sendPacket(this.socket, Protocol.SCMD_DRAW7272, buf)
		} else {
			debug('trying to emit to nonexistaant socket: ', this.id)
		}
	}

	clearAllKeys() {
		for (var i = 0; i < this.keysTotal; ++i) {
			if (this.socket !== undefined) {
				var buf = Protocol.SCMD_DRAW7272_PARSER.serialize({
					deviceId: this.deviceId,
					keyIndex: i,
					image: this.clearImage,
				})
				Protocol.sendPacket(this.socket, Protocol.SCMD_DRAW7272, buf)
			} else {
				debug('trying to emit to nonexistaant socket: ', this.id)
			}
		}
	}

	getConfig(cb) {
		debug('getConfig')

		if (typeof cb == 'function') {
			cb(this._config)
		}

		return this._config
	}
}

module.exports = DeviceSoftwareSatellite
