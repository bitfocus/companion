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

var StreamDeck = require('elgato-stream-deck').openStreamDeck
var util = require('util')
var common = require('./common')
var debug = require('debug')('lib/usb/elgato_base')

function elgato_base(system, devicepath, type) {
	var self = this

	self.config = {
		brightness: 100,
		rotation: 0,
		page: 1,
	}

	process.on('uncaughtException', function (err) {
		system.emit('log', `device(${self.serialnumber})`, 'debug', `uncaughtException: ${err}`)
	})
	process.on('unhandledRejection', function (err) {
		system.emit('log', `device(${self.serialnumber})`, 'debug', `unhandledRejection: ${err}`)
	})

	debug(`Adding ${type} USB device`, devicepath)

	self.devicepath = devicepath
	self.streamDeck = new StreamDeck(devicepath, {
		// useOriginalKeyOrder: true,
		jpegOptions: {
			quality: 95,
			subsampling: 1, // 422
		},
	})
	self.buttonState = []

	self.info = {
		type: `${type} device`,
		devicepath: devicepath,
		device_type: 'StreamDeck',
		config: ['brightness', 'orientation', 'page'],
		keysPerRow: self.streamDeck.KEY_COLUMNS,
		keysTotal: self.streamDeck.NUM_KEYS,
	}

	self.info.serialnumber = self.serialnumber = self.streamDeck.getSerialNumber()

	system.emit('log', `device(${self.serialnumber})`, 'debug', `${type} detected`)

	self.system = system

	// send elgato_base ready message to devices :)
	setImmediate(function () {
		system.emit('elgato_ready', devicepath)
	})

	self.streamDeck.on('down', function (keyIndex) {
		var key = self.toGlobalKey(keyIndex)

		self.buttonState[key].pressed = true
		self.system.emit('elgato_click', devicepath, key, true, self.buttonState)
	})

	self.streamDeck.on('up', function (keyIndex) {
		var key = self.toGlobalKey(keyIndex)

		self.buttonState[key].pressed = false
		self.system.emit('elgato_click', devicepath, key, false, self.buttonState)
	})

	self.streamDeck.on('error', function (error) {
		console.error(error)
		system.emit('elgatodm_remove_device', devicepath)
	})

	// Initialize button state hash
	for (var button = 0; button < global.MAX_BUTTONS; button++) {
		self.buttonState[button] = {
			pressed: false,
		}
	}

	self.streamDeck.clearAllKeys()

	common.apply(this)

	return self
}

elgato_base.prototype.setConfig = function (config) {
	var self = this

	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		try {
			self.streamDeck.setBrightness(config.brightness)
		} catch (e) {
			self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
		}
	}

	if (self.config.rotation != config.rotation && config.rotation !== undefined) {
		self.config.rotation = config.rotation
		self.system.emit('device_redraw', self.devicepath)
	}

	if (self.config.page != config.page && config.page !== undefined) {
		self.config.page = config.page

		// also handeled in usb.js
		self.system.emit('device_redraw', self.devicepath)
	}

	self.config = config
}

elgato_base.prototype.quit = function () {
	var self = this
	var sd = self.streamDeck

	if (sd !== undefined) {
		try {
			this.clearDeck()
		} catch (e) {}

		sd.close()
	}
}

elgato_base.prototype.begin = function () {
	var self = this
	self.log('elgato_base.prototype.begin()')

	try {
		self.streamDeck.setBrightness(self.config.brightness)
	} catch (e) {
		self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
	}
}

elgato_base.prototype.clearDeck = function () {
	var self = this
	self.log('elgato_base.prototype.clearDeck()')

	try {
		self.streamDeck.clearAllKeys()
	} catch (e) {
		self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Clear deck failed: ${e}`)
	}
}

util.inherits(elgato_base, common)

exports = module.exports = elgato_base
