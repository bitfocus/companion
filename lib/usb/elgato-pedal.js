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

var util = require('util')
var common = require('./common')
var debug = require('debug')('lib/usb/elgato_pedal')
var elgato_base = require('./elgato-base')
var StreamDeck = require('@elgato-stream-deck/node').openStreamDeck

function elgato_pedal(system, devicepath) {
	var self = this

	self.config = {
		page: 1,
	}

	process.on('uncaughtException', function (err) {
		system.emit('log', `device(${self.serialnumber})`, 'debug', `uncaughtException: ${err}`)
	})
	process.on('unhandledRejection', function (err) {
		system.emit('log', `device(${self.serialnumber})`, 'debug', `unhandledRejection: ${err}`)
	})

	debug(`Adding Elgato Streamdeck Pedal USB device`, devicepath)

	self.devicepath = devicepath
	self.streamDeck = StreamDeck(devicepath)

	self.info = {
		type: `Elgato Streamdeck Pedal device`,
		devicepath: devicepath,
		config: [],
		keysPerRow: self.streamDeck.KEY_COLUMNS,
		keysTotal: self.streamDeck.NUM_KEYS,
	}

	self.system = system

	self.streamDeck
		.getSerialNumber()
		.then((serial) => {
			self.info.serialnumber = self.serialnumber = serial
			self.finish_add()

			self.system.emit(
				'log',
				`device(${self.serialnumber})`,
				'debug',
				`Elgato ${self.streamDeck.PRODUCT_NAME} detected`
			)

			// send elgato_base ready message to devices :)
			setImmediate(() => {
				self.system.emit('elgato_ready', devicepath)
			})
		})
		.catch((err) => {
			console.error(err)
			self.system.emit('log', `device(${self.serialnumber})`, 'error', `Get serialnumber failed`)
			self.system.emit('elgatodm_remove_device', devicepath)
		})

	self.streamDeck.on('down', function (keyIndex) {
		var key = self.toGlobalKey(keyIndex)

		self.system.emit('elgato_click', devicepath, key, true)
	})

	self.streamDeck.on('up', function (keyIndex) {
		var key = self.toGlobalKey(keyIndex)

		self.system.emit('elgato_click', devicepath, key, false)
	})

	self.streamDeck.on('error', function (error) {
		console.error(error)
		system.emit('elgatodm_remove_device', devicepath)
	})

	common.apply(self)

	return self
}

elgato_pedal.prototype.setConfig = function (config) {
	var self = this

	self.config = config

	return false
}

elgato_pedal.prototype.quit = function () {
	var self = this
	var sd = self.streamDeck

	if (sd !== undefined) {
		sd.close()
	}
}

elgato_pedal.prototype.begin = function () {
	var self = this
	self.log('elgato_pedal.prototype.begin()')

	// Not supported
}

elgato_pedal.prototype.clearDeck = function () {
	var self = this

	// Not supported
}
elgato_pedal.prototype.draw = function (key, buffer, style) {
	var self = this

	// Not supported

	return true
}

util.inherits(elgato_pedal, elgato_base)

exports = module.exports = elgato_pedal
