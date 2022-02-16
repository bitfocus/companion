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
var debug = require('debug')('lib/elgato_emulator_device')
var path = require('path')
var common = require('./usb/common')

var system
var io

function elgatoEmulatorDevice(_system, devicepath) {
	var self = this

	system = _system
	EventEmitter.call(self)

	self.type = 'Elgato Streamdeck Emulator'
	self.serialnumber = 'emulator'
	self.id = 'emulator'
	self.keysPerRow = 8
	self.keysTotal = 32

	debug('Adding Elgato Streamdeck Emulator')

	self.devicepath = devicepath
	self.keys = {}

	self.config = []
	self._config = {}

	system.emit('get_userconfig', function (obj) {
		self._config = obj
	})

	system.emit('io_get', function (_io) {
		io = _io
	})

	system.on('io_connect', function (socket) {
		socket.on('emul_startup', function () {
			socket.join('emulator')

			socket.emit('emul_controlkeys', self._config['emulator_control_enable'])
			for (var key in self.keys) {
				socket.emit('emul_fillImage', key, self.keys[key])
			}
		})

		socket.on('emul_down', function (keyIndex) {
			var key = self.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}
			system.emit('elgato_click', devicepath, key, true)
		})

		socket.on('emul_up', function (keyIndex) {
			var key = self.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}
			system.emit('elgato_click', devicepath, key, false)
		})
	})

	setImmediate(function () {
		system.emit('elgato_ready', devicepath)
	})

	common.apply(this, arguments)
}

// Manual inherit
for (var key in common.prototype) {
	elgatoEmulatorDevice.prototype[key] = common.prototype[key]
}

util.inherits(elgatoEmulatorDevice, EventEmitter)

elgatoEmulatorDevice.prototype.begin = function () {}
elgatoEmulatorDevice.prototype.quit = function () {}

elgatoEmulatorDevice.prototype.draw = function (key, buffer, style) {
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

elgatoEmulatorDevice.prototype.mapButton = function (input) {
	var self = this
	var map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)
	var devkey = self.toDeviceKey(input)
	if (devkey < 0) {
		return -1
	}

	return parseInt(map[devkey])
}

elgatoEmulatorDevice.prototype.reverseButton = function (input) {
	var self = this

	var map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)
	for (var pos = 0; pos < map.length; pos++) {
		if (map[input] == pos) return self.toGlobalKey(pos)
	}

	return
}

elgatoEmulatorDevice.prototype.clearDeck = function () {
	var self = this
	debug('elgato.prototype.clearDeck()')
	for (var x = 0; x < self.keysTotal; x++) {
		self.clearKey(x)
	}
}

/* elgato-streamdeck functions */

elgatoEmulatorDevice.prototype.fillImage = function (keyIndex, imageBuffer) {
	var self = this

	if (imageBuffer.length !== 15552) {
		throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
	}

	self.keys[keyIndex] = imageBuffer

	io.emitToRoom('emulator', 'emul_fillImage', keyIndex, imageBuffer)
}

elgatoEmulatorDevice.prototype.clearKey = function (keyIndex) {
	var self = this

	self.keys[keyIndex] = Buffer.alloc(15552)

	io.emitToRoom('emulator', 'emul_clearKey', keyIndex)
}

module.exports = elgatoEmulatorDevice
