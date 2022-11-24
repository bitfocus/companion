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

var Infinitton = require('infinitton-idisplay')
var util = require('util')
var debug = require('debug')('lib/usb/infinitton')
var common = require('./common')

function infinitton(system, devicepath) {
	var self = this

	self.info = {}
	self.type = self.info.type = 'Infinitton iDisplay device'
	self.info.config = ['brightness', 'orientation']
	self.info.keysPerRow = 5
	self.info.keysTotal = 15

	self.config = {
		brightness: 100,
		rotation: 0,
		page: 1,
	}

	debug('Adding infinitton iDisplay USB device', devicepath)

	self.info.devicepath = self.devicepath = devicepath
	self.Infinitton = new Infinitton(devicepath)

	self.info.serialnumber = self.serialnumber = self.Infinitton.device.getDeviceInfo().serialNumber

	system.emit('log', 'device(' + self.serialnumber + ')', 'debug', 'Infinitton detected')

	// How many items we have left to load until we're ready to begin
	self.system = system

	// send infinitton ready message to devices :)
	setImmediate(function () {
		system.emit('elgato_ready', devicepath)
	})

	self.Infinitton.on('down', function (keyIndex) {
		var key = self.reverseButton(keyIndex)

		if (key === undefined) {
			return
		}

		self.system.emit('elgato_click', devicepath, key, true)
	})

	self.Infinitton.on('up', function (keyIndex) {
		var key = self.reverseButton(keyIndex)

		if (key === undefined) {
			return
		}

		self.system.emit('elgato_click', devicepath, key, false)
	})

	self.Infinitton.on('error', function (error) {
		console.error(error)
		system.emit('elgatodm_remove_device', devicepath)
	})

	common.apply(this, arguments)

	self.clearDeck()

	return self
}
util.inherits(infinitton, common)

infinitton.prototype.setConfig = function (config) {
	var self = this

	let redraw = false

	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		self.Infinitton.setBrightness(config.brightness)
	}

	if (self.config.rotation != config.rotation && config.rotation !== undefined) {
		redraw = true
	}

	self.config = config

	return redraw
}

infinitton.prototype.quit = function () {
	var self = this
	var sd = self.Infinitton

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

infinitton.prototype.draw = function (key, buffer, style) {
	var self = this

	try {
		key = self.mapButton(key)

		if (key >= 0 && !isNaN(key)) {
			buffer = self.handleBuffer(buffer)
			self.Infinitton.fillImage(key, buffer)
		}
	} catch (e) {
		self.log('Infinitton error: ' + e.message)
		self.system.emit('elgatodm_remove_device', self.devicepath)
	}

	return true
}

infinitton.prototype.begin = function () {
	var self = this
	self.log('infinitton.prototype.begin()')

	self.Infinitton.setBrightness(self.config.brightness)
}

infinitton.prototype.mapButton = function (input) {
	var self = this
	var map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
	var devkey = self.toDeviceKey(input)

	if (devkey < 0) {
		return -1
	}

	return parseInt(map[devkey])
}

infinitton.prototype.reverseButton = function (input) {
	var self = this

	var map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return self.toGlobalKey(pos)
	}

	return
}

infinitton.prototype.clearDeck = function () {
	var self = this
	self.log('infinitton.prototype.clearDeck()')

	for (var x = 0; x < self.info.keysTotal; x++) {
		self.Infinitton.clearKey(x)
	}
}

exports = module.exports = infinitton
