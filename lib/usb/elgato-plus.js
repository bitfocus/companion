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
var debug = require('debug')('lib/usb/elgato_plus')
var StreamDeck = require('@elgato-stream-deck/node').openStreamDeck
var sharp = require('sharp')
var image_write_queue = require('./image-write-queue')
var setTimeoutPromise = util.promisify(setTimeout)

function elgato_plus(system, devicepath) {
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

	debug(`Adding Elgato Streamdeck + USB device`, devicepath)

	self.devicepath = devicepath
	self.streamDeck = StreamDeck(devicepath)

	self.info = {
		type: `Elgato Streamdeck + device`,
		devicepath: devicepath,
		config: [],
		keysPerRow: self.streamDeck.KEY_COLUMNS,
		keysTotal: (self.streamDeck.KEY_ROWS + 2) * self.streamDeck.KEY_COLUMNS,
	}

	self.system = system

	self.write_queue = new image_write_queue(async function (key, buffer) {
		let newbuffer
		try {
			newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
				.resize(120, 120)
				.raw()
				.toBuffer()
		} catch (e) {
			self.system.emit('log', 'device(' + self.serialnumber + ')', 'debug', `scale image failed: ${e}`)
			self.system.emit('elgatodm_remove_device', self.devicepath)
			return
		}

		const maxAttempts = 3
		for (let attempts = 1; attempts <= maxAttempts; attempts++) {
			try {
				self.streamDeck.fillKeyBuffer(key, newbuffer)
				return
			} catch (e) {
				if (attempts == maxAttempts) {
					self.system.emit(
						'log',
						'device(' + self.serialnumber + ')',
						'error',
						`fillImage failed after ${attempts}: ${e}`
					)
					self.system.emit('elgatodm_remove_device', self.devicepath)
					return
				}
				await setTimeoutPromise(20)
			}
		}
	})
	self.lcd_write_queue = new image_write_queue(async function (key, buffer) {
		let newbuffer
		try {
			newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
				.resize(100, 100)
				.raw()
				.toBuffer()
		} catch (e) {
			self.system.emit('log', 'device(' + self.serialnumber + ')', 'debug', `scale image failed: ${e}`)
			self.system.emit('elgatodm_remove_device', self.devicepath)
			return
		}

		const maxAttempts = 3
		for (let attempts = 1; attempts <= maxAttempts; attempts++) {
			try {
				const x = key * 200 + 50
				self.streamDeck.fillLcdRegion(x, 0, newbuffer, {
					format: 'rgb',
					width: 100,
					height: 100,
				})
				return
			} catch (e) {
				if (attempts == maxAttempts) {
					self.system.emit(
						'log',
						'device(' + self.serialnumber + ')',
						'error',
						`fillImage failed after ${attempts}: ${e}`
					)
					self.system.emit('elgatodm_remove_device', self.devicepath)
					return
				}
				await setTimeoutPromise(20)
			}
		}
	})

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

	self.streamDeck.on('encoderDown', function (keyIndex) {
		var key = self.toGlobalKey(12 + keyIndex)

		self.system.emit('elgato_click', devicepath, key, true)
	})
	self.streamDeck.on('encoderUp', function (keyIndex) {
		var key = self.toGlobalKey(12 + keyIndex)

		self.system.emit('elgato_click', devicepath, key, false)
	})
	self.streamDeck.on('rotateLeft', function (keyIndex) {
		var key = self.toGlobalKey(12 + keyIndex)

		self.system.emit('elgato_rotate', devicepath, key, false)
	})
	self.streamDeck.on('rotateRight', function (keyIndex) {
		var key = self.toGlobalKey(12 + keyIndex)

		self.system.emit('elgato_rotate', devicepath, key, true)
	})

	self.streamDeck.on('lcdShortPress', function (keyIndex) {
		var key = self.toGlobalKey(8 + keyIndex)

		self.system.emit('elgato_click', devicepath, key, true)

		setTimeout(() => {
			self.system.emit('elgato_click', devicepath, key, false)
		}, 20)
	})
	self.streamDeck.on('lcdLongPress', function (keyIndex) {
		var key = self.toGlobalKey(8 + keyIndex)

		self.system.emit('elgato_click', devicepath, key, true)

		setTimeout(() => {
			self.system.emit('elgato_click', devicepath, key, false)
		}, 20)
	})

	self.streamDeck.on('error', function (error) {
		console.error(error)
		system.emit('elgatodm_remove_device', devicepath)
	})

	common.apply(self)

	return self
}

elgato_plus.prototype.setConfig = function (config) {
	var self = this

	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		self.streamDeck.setBrightness(config.brightness).catch((e) => {
			self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
		})
	}

	if (self.config.rotation != config.rotation && config.rotation !== undefined) {
		redraw = true
	}

	self.config = config

	return false
}

elgato_plus.prototype.quit = function () {
	var self = this
	var sd = self.streamDeck

	if (sd !== undefined) {
		sd.close()
	}
}

elgato_plus.prototype.begin = function () {
	var self = this
	self.log('elgato_plus.prototype.begin()')

	self.streamDeck.clearPanel().catch((e) => {
		self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Clear deck failed: ${e}`)
	})

	self.streamDeck.setBrightness(self.config.brightness).catch((e) => {
		self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
	})
}

elgato_plus.prototype.clearDeck = function () {
	var self = this

	self.streamDeck.clearPanel().catch((e) => {
		self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Clear deck failed: ${e}`)
	})
}
elgato_plus.prototype.draw = function (key, buffer, style) {
	var self = this

	var button = self.toDeviceKey(key)
	if (button < 0 || button >= 12) {
		return true
	}

	buffer = self.handleBuffer(buffer)

	if (button >= 8) {
		self.lcd_write_queue.queue(button - 8, buffer)
	} else {
		self.write_queue.queue(button, buffer)
	}

	return true
}

util.inherits(elgato_plus, common)

exports = module.exports = elgato_plus
