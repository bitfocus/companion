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
var debug = require('debug')('lib/elgato_plugin_device')

function elgatoPluginDevice(system, devicepath) {
	var self = this

	self.system = system
	EventEmitter.call(self)

	self.type = 'Elgato Streamdeck Plugin'
	self.serialnumber = 'plugin'
	self.id = devicepath

	debug('Adding Elgato Streamdeck Plugin')

	self.devicepath = devicepath
	self.config = ['orientation']
	self.keysPerRow = 8
	self.keysTotal = 32

	self._config = {
		rotation: 0,
	}

	self.system.once(devicepath + '_plugin_startup', function (socket) {
		self.socket = socket

		self.system.emit('elgato_ready', devicepath)

		socket.on('keydown', function (data) {
			var key = data.keyIndex
			var page = data.page
			var bank = data.bank

			if (key !== undefined) {
				self.system.emit('elgato_click', devicepath, key, true)
			} else if (page !== undefined && bank !== undefined) {
				self.system.emit('bank_pressed', page, bank + 1, true, self.devicepath)
				self.system.emit(
					'log',
					'device(' + self.devicepath + ')',
					'debug',
					'Button ' + page + '.' + (bank + 1) + ' pressed'
				)
			}
		})

		socket.on('keyup', function (data) {
			var key = data.keyIndex
			var page = data.page
			var bank = data.bank

			if (key !== undefined) {
				self.system.emit('elgato_click', devicepath, key, false)
			} else if (page !== undefined && bank !== undefined) {
				self.system.emit('bank_pressed', page, bank + 1, false, self.devicepath)
				self.system.emit(
					'log',
					'device(' + self.devicepath + ')',
					'debug',
					'Button ' + page + '.' + (bank + 1) + ' released'
				)
			}
		})
	})
}

util.inherits(elgatoPluginDevice, EventEmitter)

elgatoPluginDevice.prototype.begin = function () {}

elgatoPluginDevice.prototype.quit = function () {
	socket.removeAllListeners('keyup')
	socket.removeAllListeners('keydown')
}

elgatoPluginDevice.prototype.draw = function (key, buffer, style) {
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

elgatoPluginDevice.prototype.clearDeck = function () {
	var self = this
	debug('elgato.prototype.clearDeck()')
	self.clearAllKeys()
}

/* elgato-streamdeck functions */

elgatoPluginDevice.prototype.setConfig = function (config, cb) {
	var self = this

	let redraw = false

	if (self._config.rotation != config.rotation && config.rotation !== undefined) {
		redraw = true
	}

	self._config = config

	cb(redraw)
}

elgatoPluginDevice.prototype.fillImage = function (keyIndex, imageBuffer) {
	var self = this

	if (imageBuffer.length !== 15552) {
		throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
	}

	if (self.socket !== undefined) {
		self.socket.apicommand('fillImage', { keyIndex: keyIndex, data: imageBuffer })
	} else {
		//debug('trying to emit to nonexistaant socket: ', self.id);
	}
}

elgatoPluginDevice.prototype.clearAllKeys = function () {
	var self = this

	const emptyBuffer = Buffer.alloc(72 * 72 * 3)

	for (var i = 0; i < global.MAX_BUTTONS; ++i) {
		if (self.socket !== undefined) {
			self.socket.apicommand('fillImage', { keyIndex: i, data: emptyBuffer })
		} else {
			debug('trying to emit to nonexistaant socket: ', self.id)
		}
	}
}

// Steal rotation code from usb/common
var common = require('./usb/common')
elgatoPluginDevice.prototype.handleBuffer = common.prototype.handleBuffer

module.exports = elgatoPluginDevice
