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

/**
 * This legacy Satellite API is deprecated. Please use the new Satellite API instead.
 * The new API can do more, in a simpler and more flexible protocol
 */

const common = require('./usb/common')
const { EventEmitter } = require('events')
const { Mixin } = require('ts-mixer')
const protocol = require('./satellite_protocol_legacy')

class satellite extends Mixin(EventEmitter, common) {
	debug = require('debug')('lib/satellite_device')

	constructor(system, devicepath, deviceInfo) {
		super()
		this.system = system

		this.type = 'Satellite device'
		this.serialnumber = devicepath
		this.id = devicepath
		this.keysPerRow = deviceInfo.keysPerRow ? deviceInfo.keysPerRow : 8
		this.keysTotal = deviceInfo.keysTotal ? deviceInfo.keysTotal : 32

		this.debug('Adding Satellite device')

		this.devicepath = devicepath
		this.config = ['orientation', 'brightness']

		this._config = {
			rotation: 0,
			brightness: 100,
		}

		this.debug('Waiting for satellite startup: ', devicepath + '_satellite_startup')
		this.system.once(devicepath + '_satellite_startup', function (socket, deviceId) {
			this.socket = socket
			this.deviceId = deviceId

			this.system.emit('elgato_ready', devicepath)
		})

		this.system.on(devicepath + '_button', function (key, state) {
			this.doButton(key, state)
		})

		this.clearImage = Buffer.alloc(72 * 72 * 3)
	}

	begin() {
		this.setBrightness(this._config.brightness)
	}

	quit() {
		this.system.removeAllListeners(this.devicepath + '_button')
	}

	draw(key, buffer, style) {
		if (buffer === undefined || buffer.length != 15552) {
			this.debug('buffer was not 15552, but ', buffer.length)
			return false
		}

		buffer = this.handleBuffer(buffer)

		this.fillImage(key, buffer)

		return true
	}

	doButton(key, state) {
		const keyIndex2 = this.toGlobalKey(key)

		if (keyIndex2 >= 0 && keyIndex2 < global.MAX_BUTTONS) {
			this.system.emit('elgato_click', this.devicepath, keyIndex2, state)
		}
	}

	clearDeck() {
		this.debug('elgato.prototype.clearDeck()')
		if (this.socket !== undefined) {
			for (var i = 0; i < this.keysTotal; ++i) {
				var buf = protocol.SCMD_DRAW7272_PARSER.serialize({
					deviceId: this.deviceId,
					keyIndex: i,
					image: this.clearImage,
				})
				protocol.sendPacket(this.socket, protocol.SCMD_DRAW7272, buf)
			}
		} else {
			this.debug('trying to emit to nonexistaant socket: ', this.id)
		}
	}

	/* elgato-streamdeck functions */

	setConfig(config, cb) {
		let redraw = false

		if (this._config.rotation != config.rotation && config.rotation !== undefined) {
			redraw = true
		}

		if (this._config.brightness != config.brightness && config.brightness !== undefined) {
			this.setBrightness(config.brightness)
		}

		this._config = config

		cb(redraw)
	}

	fillImage(keyIndex, imageBuffer) {
		const keyIndex2 = this.toDeviceKey(keyIndex)
		if (keyIndex2 === -1) return

		if (imageBuffer.length !== 15552) {
			throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
		}

		if (this.socket !== undefined) {
			var buf = protocol.SCMD_DRAW7272_PARSER.serialize({
				deviceId: this.deviceId,
				keyIndex: keyIndex2,
				image: imageBuffer,
			})

			protocol.sendPacket(this.socket, protocol.SCMD_DRAW7272, buf)
		}
	}

	setBrightness(value) {
		this.debug('brightness: ' + value)
		if (this.socket !== undefined) {
			var buf = protocol.SCMD_BRIGHTNESS_PARSER.serialize({
				deviceId: this.deviceId,
				percent: value,
			})

			protocol.sendPacket(this.socket, protocol.SCMD_BRIGHTNESS, buf)
		}
	}
}

module.exports = satellite
