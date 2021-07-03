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

function satellite_device_v2(system, deviceInfo) {
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

	debug('Adding Satellite device')

	self.devicepath = deviceInfo.path
	self.config = ['orientation', 'brightness', 'page']

	self._config = {
		rotation: 0,
		brightness: 100,
	}

	self.keyColorChanged = self.keyColorChanged.bind(self)
	if (self.streamColors) {
		self.system.on('graphics_set_bank_bg', self.keyColorChanged)
	}

	system.on(deviceInfo.path + '_button', function (key, state) {
		self.doButton(key, state)
	})

	setImmediate(() => {
		system.emit('elgato_ready', self.devicepath)
	})
}

util.inherits(satellite_device_v2, EventEmitter)

satellite_device_v2.prototype.keyColorChanged = function (page, bank, bgcolor) {
	var self = this

	if (self.socket !== undefined && self.deviceHandler && self.deviceHandler.page == page) {
		// convert color to hex
		const color = bgcolor.toString(16).padStart(6, '0')
		self.socket.write(`KEY-COLOR DEVICEID=${self.deviceId} KEY=${bank} COLOR=#${color}\n`)
	}
}

satellite_device_v2.prototype.begin = function () {
	var self = this

	self.setBrightness(self._config.brightness)
}

satellite_device_v2.prototype.quit = function () {
	var self = this
	self.system.removeAllListeners(self.devicepath + '_button')
	self.system.off('graphics_set_bank_bg', self.keyColorChanged)
}

satellite_device_v2.prototype.draw = function (key, buffer) {
	var self = this

	if (buffer === undefined || buffer.length != 15552) {
		debug('buffer was not 15552, but ', buffer.length)
		return false
	}

	const keyIndex2 = self.toDeviceKey(key)
	if (keyIndex2 === -1) return

	if (self.socket !== undefined && self.streamBitmaps) {
		buffer = self.handleBuffer(buffer)

		self.socket.write(`KEY-DRAW DEVICEID=${self.deviceId} KEY=${keyIndex2} DATA=${buffer.toString('base64')}\n`)
	}

	return true
}

satellite_device_v2.prototype.doButton = function (key, state) {
	var self = this

	const keyIndex2 = this.toGlobalKey(key)

	self.system.emit('elgato_click', self.devicepath, keyIndex2, state)
}

satellite_device_v2.prototype.clearDeck = function () {
	var self = this
	debug('elgato.prototype.clearDeck()')
	if (self.socket !== undefined) {
		self.socket.write(`CLEAR-DECK DEVICEID=${self.deviceId}\n`)
	} else {
		debug('trying to emit to nonexistaant socket: ', self.id)
	}
}

/* elgato-streamdeck functions */

satellite_device_v2.prototype.setConfig = function (config) {
	var self = this

	if (self._config.rotation != config.rotation && config.rotation !== undefined) {
		self._config.rotation = config.rotation
		self.system.emit('device_redraw', self.devicepath)
	}

	if (self._config.brightness != config.brightness && config.brightness !== undefined) {
		self._config.brightness = config.brightness
		self.setBrightness(config.brightness)
	}

	if (self.deviceHandler) {
		// Custom override, page should have been inside the deviceconfig object
		if (config.page !== undefined) {
			self.deviceHandler.page = config.page
			self.deviceHandler.updatePagedevice()
		}
	}

	self._config = config

	if (self.deviceHandler) {
		self.deviceconfig = config
		self.deviceHandler.updatedConfig()
	}
}

satellite_device_v2.prototype.setBrightness = function (value) {
	var self = this

	debug('brightness: ' + value)
	if (self.socket !== undefined) {
		self.socket.write(`BRIGHTNESS DEVICEID=${self.deviceId} VALUE=${value}\n`)
	}
}

// Steal rotation code from usb/common
var common = require('../usb/common')
util.inherits(satellite_device_v2, common)

satellite_device_v2.prototype.getConfig = function (cb) {
	var self = this

	debug('getConfig')

	if (typeof cb == 'function') {
		cb(self._config)
	}

	return self._config
}

module.exports = satellite_device_v2
