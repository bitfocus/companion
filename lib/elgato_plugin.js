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
var EventEmitter = require('events').EventEmitter
var util = require('util')
var debug = require('debug')('lib/elgato_plugin')
var path = require('path')

var system
var express
var io

function elgatoPlugin(_system, devicepath) {
	var self = this

	self.system = system = _system
	EventEmitter.call(self)
	self.buttonState = []

	self.type = 'Elgato Streamdeck Plugin'
	self.serialnumber = 'plugin'
	self.id = devicepath

	debug('Adding Elgato Streamdeck Plugin')

	self.devicepath = devicepath
	self.keys = {}
	self.device_type = 'StreamDeck Plugin'
	self.config = ['orientation', 'page']
	self.keysPerRow = 8
	self.keysTotal = 32

	self._config = {
		rotation: 0,
	}

	system.once(devicepath + '_plugin_startup', function (socket) {
		self.socket = socket

		system.emit('elgato_ready', devicepath)

		socket.on('keydown', function (data) {
			var key = data.keyIndex
			var page = data.page
			var bank = data.bank

			if (key !== undefined) {
				self.buttonState[key].pressed = true
				system.emit('elgato_click', devicepath, key, true, self.buttonState)
			} else if (page !== undefined && bank !== undefined) {
				system.emit('bank_pressed', page, bank + 1, true, self.devicepath)
				system.emit('log', 'device(' + self.devicepath + ')', 'debug', 'Button ' + page + '.' + (bank + 1) + ' pressed')
			}
		})

		socket.on('keyup', function (data) {
			var key = data.keyIndex
			var page = data.page
			var bank = data.bank

			if (key !== undefined) {
				self.buttonState[key].pressed = false
				system.emit('elgato_click', devicepath, key, false, self.buttonState)
			} else if (page !== undefined && bank !== undefined) {
				system.emit('bank_pressed', page, bank + 1, false, self.devicepath)
				system.emit(
					'log',
					'device(' + self.devicepath + ')',
					'debug',
					'Button ' + page + '.' + (bank + 1) + ' released'
				)
			}
		})
	})

	for (var button = 0; button < global.MAX_BUTTONS; button++) {
		self.buttonState[button] = {
			pressed: false,
		}
	}
}
elgatoPlugin.device_type = 'StreamDeck Plugin'

util.inherits(elgatoPlugin, EventEmitter)

elgatoPlugin.prototype.begin = function () {}

elgatoPlugin.prototype.quit = function () {
	socket.removeAllListeners('keyup')
	socket.removeAllListeners('keydown')
}

elgatoPlugin.prototype.draw = function (key, buffer) {
	var self = this

	if (buffer === undefined || buffer.length != 15552) {
		debug('buffer was not 15552, but ', buffer.length)
		return false
	}

	// TODO: Fix
	var hack = { log: self.debug, config: self._config }
	buffer = self.handleBuffer.call(hack, buffer)

	self.fillImage(key, buffer)

	return true
}

elgatoPlugin.prototype.clearDeck = function () {
	var self = this
	debug('elgato.prototype.clearDeck()')
	self.clearAllKeys()
}

/* elgato-streamdeck functions */

elgatoPlugin.prototype.getConfig = function (cb) {
	var self = this

	debug('getConfig')

	if (typeof cb == 'function') {
		cb(self._config)
	}

	return self._config
}

elgatoPlugin.prototype.setConfig = function (config) {
	var self = this

	if (self._config.rotation != config.rotation && config.rotation !== undefined) {
		self._config.rotation = config.rotation
		self.system.emit('device_redraw', self.devicepath)
	}

	if (self.deviceHandler) {
		// Custom override, page should have been inside the deviceconfig object
		if (config.page !== undefined) {
			debug('update page in deviceHandler! ' + (self.deviceHandler !== undefined ? 'yes' : 'no'))
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

elgatoPlugin.prototype.fillImage = function (keyIndex, imageBuffer) {
	var self = this

	if (imageBuffer.length !== 15552) {
		throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
	}

	self.keys[keyIndex] = imageBuffer

	if (self.socket !== undefined) {
		self.socket.apicommand('fillImage', { keyIndex: keyIndex, data: imageBuffer })
	} else {
		//debug('trying to emit to nonexistaant socket: ', self.id);
	}
}

elgatoPlugin.prototype.clearKey = function (keyIndex) {
	var self = this

	self.keys[keyIndex] = Buffer.alloc(15552)

	if (self.socket !== undefined) {
		self.socket.apicommand('fillImage', { keyIndex: keyIndex, data: self.keys[keyIndex] })
	} else {
		debug('trying to emit to nonexistaant socket: ', self.id)
	}
}

elgatoPlugin.prototype.clearAllKeys = function () {
	var self = this

	for (var i = 0; i < global.MAX_BUTTONS; ++i) {
		self.keys[i] = Buffer.alloc(15552)

		if (self.socket !== undefined) {
			self.socket.apicommand('fillImage', { keyIndex: i, data: self.keys[i] })
		} else {
			debug('trying to emit to nonexistaant socket: ', self.id)
		}
	}
}

// Steal rotation code from usb/common
var common = require('./usb/common')
elgatoPlugin.prototype.handleBuffer = common.prototype.handleBuffer

// Not supported
elgatoPlugin.prototype.setBrightness = function (value) {}

module.exports = elgatoPlugin
