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
const { EventEmitter } = require('events')
const util = require('util')
const debug = require('debug')('lib/satellite_device')

function satellite_device(system, deviceInfo) {
	var self = this

	self.system = system
	EventEmitter.call(self)

	self.type = deviceInfo.productName
	self.deviceId = deviceInfo.deviceId
	self.serialnumber = deviceInfo.path
	self.id = deviceInfo.path
	self.keysPerRow = deviceInfo.keysPerRow
	self.keysTotal = deviceInfo.keysTotal
	self.socket = deviceInfo.socket
	self.streamBitmaps = deviceInfo.streamBitmaps
	self.streamColors = deviceInfo.streamColors
	self.streamText = deviceInfo.streamText

	debug('Adding Satellite device')

	self.devicepath = deviceInfo.path
	self.config = ['brightness']
	if (self.streamBitmaps) {
		self.config.push('orientation')
	}

	self._config = {
		rotation: 0,
		brightness: 100,
	}

	system.on(deviceInfo.path + '_button', function (key, state) {
		self.doButton(key, state)
	})

	setImmediate(() => {
		system.emit('elgato_ready', self.devicepath)
	})
}

util.inherits(satellite_device, EventEmitter)

satellite_device.prototype.begin = function () {
	var self = this

	self.setBrightness(self._config.brightness)
}

satellite_device.prototype.quit = function () {
	var self = this
	self.system.removeAllListeners(self.devicepath + '_button')
}

satellite_device.prototype.draw = function (key, buffer, style, isPressed) {
	var self = this

	const keyIndex2 = self.toDeviceKey(key)
	if (keyIndex2 === -1) return

	if (self.socket !== undefined) {
		let params = ``
		if (self.streamColors) {
			// convert color to hex
			const bgcolor = style && typeof style.bgcolor === 'number' ? style.bgcolor : 0
			const color = bgcolor.toString(16).padStart(6, '0')

			params += ` COLOR=#${color}`
		}
		if (self.streamBitmaps) {
			if (buffer === undefined || buffer.length != 15552) {
				debug('buffer was not 15552, but ', buffer.length)
			} else {
				params += ` BITMAP=${self.handleBuffer(buffer).toString('base64')}`
			}
		}
		if (self.streamText) {
			let text = ''
			if (style && style.text) {
				self.system.emit('variable_parse', style.text, (text0) => {
					text = text0
				})
			}
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

		params += ` PRESSED=${isPressed ? 'true' : 'false'}`

		self.socket.write(`KEY-STATE DEVICEID=${self.deviceId} KEY=${keyIndex2} TYPE=${type} ${params}\n`)
	}

	return true
}

satellite_device.prototype.doButton = function (key, state) {
	var self = this

	const keyIndex2 = this.toGlobalKey(key)

	self.system.emit('elgato_click', self.devicepath, keyIndex2, state)
}

satellite_device.prototype.clearDeck = function () {
	var self = this
	debug('elgato.prototype.clearDeck()')
	if (self.socket !== undefined) {
		self.socket.write(`KEYS-CLEAR DEVICEID=${self.deviceId}\n`)
	} else {
		debug('trying to emit to nonexistaant socket: ', self.id)
	}
}

/* elgato-streamdeck functions */

satellite_device.prototype.setConfig = function (config, cb) {
	var self = this

	let redraw = false

	if (self.streamBitmaps && self._config.rotation != config.rotation && config.rotation !== undefined) {
		redraw = true
	}

	if (self._config.brightness != config.brightness && config.brightness !== undefined) {
		self.setBrightness(config.brightness)
	}

	self._config = config

	cb(redraw)
}

satellite_device.prototype.setBrightness = function (value) {
	var self = this

	debug('brightness: ' + value)
	if (self.socket !== undefined) {
		self.socket.write(`BRIGHTNESS DEVICEID=${self.deviceId} VALUE=${value}\n`)
	}
}

// Steal rotation code from usb/common
var common = require('../usb/common')
util.inherits(satellite_device, common)

module.exports = satellite_device
