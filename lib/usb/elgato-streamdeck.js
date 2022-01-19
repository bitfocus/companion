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

var openStreamDeck = require('@elgato-stream-deck/node').openStreamDeck
var util = require('util')
var common = require('./common')
var debug = require('debug')('lib/usb/elgato_streamdeck')
var sharp = require('sharp')
var image_write_queue = require('./image-write-queue')
var setTimeoutPromise = util.promisify(setTimeout)

function elgato_streamdeck(system, devicepath) {
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

	debug(`Adding elgato_streamdeck USB device`, devicepath)

	self.devicepath = devicepath
	self.streamDeck = openStreamDeck(devicepath, {
		// useOriginalKeyOrder: true,
		jpegOptions: {
			quality: 95,
			subsampling: 1, // 422
		},
	})

	self.info = {
		type: `Elgato ${self.streamDeck.PRODUCT_NAME} device`,
		devicepath: devicepath,
		config: ['brightness', 'orientation'],
		keysPerRow: self.streamDeck.KEY_COLUMNS,
		keysTotal: self.streamDeck.NUM_KEYS,
	}

	self.system = system

	self.write_queue = new image_write_queue(async function (key, buffer) {
		let newbuffer = buffer
		const targetSize = self.streamDeck.ICON_SIZE
		if (targetSize !== 72) {
			try {
				newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
					.resize(targetSize, targetSize)
					.raw()
					.toBuffer()
			} catch (e) {
				self.system.emit('log', 'device(' + self.serialnumber + ')', 'debug', `scale image failed: ${e}`)
				self.system.emit('elgatodm_remove_device', self.devicepath)
				return
			}
		}

		const maxAttempts = 3
		for (let attempts = 1; attempts <= maxAttempts; attempts++) {
			try {
				self.streamDeck.fillKeyBuffer(key, newbuffer)
				return
			} catch (e) {
				self.system.emit(
					'log',
					'device(' + self.serialnumber + ')',
					'debug',
					`fillImage attempt ${attempts} failed: ${e}`
				)
				if (attempts == maxAttempts) {
					self.system.emit('elgatodm_remove_device', self.devicepath)
					return
				}
				await setTimeoutPromise(20)
			}
		}
	})

	self.streamDeck
		.getSerialNumber()
		.then(function (serial) {
			self.info.serialnumber = self.serialnumber = serial
			self.finish_add()

			system.emit('log', `device(${self.serialnumber})`, 'debug', `Elgato ${self.streamDeck.PRODUCT_NAME} detected`)

			// send elgato_base ready message to devices :)
			setImmediate(function () {
				system.emit('elgato_ready', devicepath)
			})

			self.streamDeck.clearPanel().catch(function (err) {
				console.error(err)
				system.emit('log', `device(${self.serialnumber})`, 'error', `Initial clear failed`)
				system.emit('elgatodm_remove_device', devicepath)
			})
		})
		.catch(function (err) {
			console.error(err)
			system.emit('log', `device(${self.serialnumber})`, 'error', `Get serialnumber failed`)
			system.emit('elgatodm_remove_device', devicepath)
		})

	self.streamDeck.on('error', function (error) {
		console.error(error)
		system.emit('elgatodm_remove_device', devicepath)
	})

	self.streamDeck.on('down', function (keyIndex) {
		var key = self.toGlobalKey(keyIndex)

		self.system.emit('elgato_click', devicepath, key, true)
	})

	self.streamDeck.on('up', function (keyIndex) {
		var key = self.toGlobalKey(keyIndex)

		self.system.emit('elgato_click', devicepath, key, false)
	})

	common.apply(this)

	return self
}

elgato_streamdeck.prototype.setConfig = function (config) {
	var self = this

	let redraw = false

	if (self.config.brightness != config.brightness && config.brightness !== undefined) {
		self.streamDeck.setBrightness(config.brightness).catch(function (e) {
			self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
		})
	}

	if (self.config.rotation != config.rotation && config.rotation !== undefined) {
		redraw = true
	}

	self.config = config

	return redraw
}

elgato_streamdeck.prototype.quit = function () {
	var self = this
	var sd = self.streamDeck

	if (sd !== undefined) {
		try {
			this.clearDeck()
		} catch (e) {}

		sd.close()
	}
}

elgato_streamdeck.prototype.begin = function () {
	var self = this
	self.log('elgato_base.prototype.begin()')

	self.streamDeck.setBrightness(self.config.brightness).catch(function (e) {
		self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
	})
}

elgato_streamdeck.prototype.clearDeck = function () {
	var self = this
	self.log('elgato_base.prototype.clearDeck()')

	self.streamDeck.clearPanel(self.config.brightness).catch(function (e) {
		self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Clear deck failed: ${e}`)
	})
}

elgato_streamdeck.prototype.draw = function (key, buffer, style) {
	var self = this

	const numKeys = self.streamDeck.NUM_KEYS
	const button = self.toDeviceKey(key)
	if (button < 0 || button >= numKeys) {
		return true
	}

	buffer = self.handleBuffer(buffer)

	self.write_queue.queue(button, buffer)

	return true
}

util.inherits(elgato_streamdeck, common)

exports = module.exports = elgato_streamdeck
