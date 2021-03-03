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

var EventEmitter = require('events').EventEmitter
var util = require('util')
var debug = require('debug')('lib/elgato_emulator')
var path = require('path')
var common = require('./usb/common')

var system
var express
var io

function elgatoEmulator(_system, devicepath) {
	var self = this

	system = _system
	EventEmitter.call(self)
	self.buttonState = []

	self.type = 'Elgato Streamdeck Emulator'
	self.serialnumber = 'emulator'
	self.id = 'emulator'
	self.keysPerRow = 8
	self.keysTotal = 32

	debug('Adding Elgato Streamdeck Emulator')

	self.devicepath = devicepath
	self.keys = {}

	self.config = []

	system.emit('get_userconfig', function (obj) {
		self.config = obj

		if (self.config['emulator_control_enable'] === undefined) {
			self.config['emulator_control_enable'] = false
			system.emit('set_userconfig_key', 'emulator_control_enable', self.config['emulator_control_enable'])
		}
	})

	system.emit('io_get', function (_io) {
		io = _io
	})

	system.on('io_connect', function (socket) {
		socket.on('emul_startup', function () {
			socket.emit('emul_controlkeys', self.config['emulator_control_enable'])
			for (var key in self.keys) {
				socket.emit('emul_fillImage', key, self.keys[key])
			}
		})

		socket.on('emul_down', function (keyIndex) {
			var key = self.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}
			self.buttonState[key].pressed = true
			system.emit('elgato_click', devicepath, key, true, self.buttonState)
		})

		socket.on('emul_up', function (keyIndex) {
			var key = self.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}
			self.buttonState[key].pressed = false
			system.emit('elgato_click', devicepath, key, false, self.buttonState)
		})
	})

	for (var button = 0; button < global.MAX_BUTTONS; button++) {
		self.buttonState[button] = {
			pressed: false,
		}
	}

	setImmediate(function () {
		system.emit('elgato_ready', devicepath)
	})

	common.apply(this, arguments)
}
elgatoEmulator.device_type = 'StreamDeck Emulator'

// Manual inherit
for (var key in common.prototype) {
	elgatoEmulator.prototype[key] = common.prototype[key]
}

util.inherits(elgatoEmulator, EventEmitter)

elgatoEmulator.prototype.begin = function () {}
elgatoEmulator.prototype.quit = function () {}

elgatoEmulator.prototype.draw = function (key, buffer) {
	var self = this

	if (buffer === undefined || buffer.length != 15552) {
		debug('buffer was not 15552, but ', buffer.length)
		return false
	}
	key = self.mapButton(key)

	if (key >= 0 && !isNaN(key)) {
		self.fillImage(key, buffer)
	}

	return true
}

elgatoEmulator.prototype.mapButton = function (input) {
	var self = this
	var map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)
	var devkey = self.toDeviceKey(input)
	if (devkey < 0) {
		return -1
	}

	return parseInt(map[devkey])
}

elgatoEmulator.prototype.reverseButton = function (input) {
	var self = this

	var map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return self.toGlobalKey(pos)
	}

	return
}

elgatoEmulator.prototype.clearDeck = function () {
	var self = this
	debug('elgato.prototype.clearDeck()')
	for (var x = 0; x < self.keysTotal; x++) {
		self.clearKey(x)
	}
}

/* elgato-streamdeck functions */

elgatoEmulator.prototype.fillImage = function (keyIndex, imageBuffer) {
	var self = this

	if (imageBuffer.length !== 15552) {
		throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
	}

	self.keys[keyIndex] = imageBuffer

	io.emit('emul_fillImage', keyIndex, imageBuffer)
}

elgatoEmulator.prototype.clearKey = function (keyIndex) {
	var self = this

	self.keys[keyIndex] = Buffer.alloc(15552)

	io.emit('clearKey', keyIndex)
}

elgatoEmulator.prototype.clearAllKeys = function () {
	var self = this

	for (var i = 0; i < global.MAX_BUTTONS; ++i) {
		self.keys[keyIndex] = Buffer.alloc(15552)
		io.emit('clearKey', keyIndex)
	}
}

elgatoEmulator.prototype.setBrightness = function (value) {
	var self = this
	// No reason to emulate this
}

module.exports = elgatoEmulator
