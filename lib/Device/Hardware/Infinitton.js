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
var DeviceBase = require('../Base')
var debug = require('debug')('Device/Hardware/Infinitton')

class DeviceHardwareInfinitton extends DeviceBase {
	static deviceType = 'Infinitton'

	constructor(system, devicepath) {
		super()
		this.system = system

		this.info = {}
		this.type = this.info.type = 'Infinitton iDisplay device'
		this.info.deviceType = 'Infinitton'
		this.info.config = ['brightness', 'orientation', 'page']
		this.info.keysPerRow = 5
		this.info.keysTotal = 15

		this.config = {
			brightness: 100,
			rotation: 0,
			page: 1,
		}

		debug('Adding infinitton iDisplay USB device', devicepath)

		this.info.devicepath = this.devicepath = devicepath
		this.Infinitton = new Infinitton(devicepath)
		this.buttonState = []

		this.info.serialnumber = this.serialnumber = this.Infinitton.device.getDeviceInfo().serialNumber

		this.checkKeyValues()

		this.system.emit('log', 'device(' + this.serialnumber + ')', 'debug', 'Infinitton detected')

		// How many items we have left to load until we're ready to begin
		this.loadingItems = 0

		// send infinitton ready message to devices :)
		setImmediate(() => {
			this.system.emit('device_ready', devicepath)
		})

		this.Infinitton.on('down', (keyIndex) => {
			var key = this.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}

			this.buttonState[key].pressed = true
			this.system.emit('device_press', devicepath, key, true, this.buttonState)
		})

		this.Infinitton.on('up', (keyIndex) => {
			var key = this.reverseButton(keyIndex)

			if (key === undefined) {
				return
			}

			this.buttonState[key].pressed = false
			this.system.emit('device_press', devicepath, key, false, this.buttonState)
		})

		this.Infinitton.on('error', (error) => {
			console.error(error)
			this.system.emit('device_remove', devicepath)
		})

		// Initialize button state hash
		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false,
			}
		}

		this.clearDeck()
	}

	begin() {
		this.log('infinitton.prototype.begin()')

		this.Infinitton.setBrightness(this.config.brightness)
	}

	clearDeck() {
		this.log('infinitton.prototype.clearDeck()')

		for (var x = 0; x < this.info.keysTotal; x++) {
			this.Infinitton.clearKey(x)
		}
	}

	draw(key, buffer) {
		try {
			key = this.mapButton(key)

			if (key >= 0 && !isNaN(key)) {
				buffer = this.handleBuffer(buffer)
				this.Infinitton.fillImage(key, buffer)
			}
		} catch (e) {
			this.log('Infinitton error: ' + e.message)
			this.system.emit('device_remove', this.devicepath)
		}

		return true
	}

	getConfig() {
		this.log('getConfig')

		return this.config
	}

	mapButton(input) {
		var map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
		var devkey = this.toDeviceKey(input)

		if (devkey < 0) {
			return -1
		}

		return parseInt(map[devkey])
	}

	quit() {
		var sd = this.Infinitton

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

	reverseButton(input) {
		var map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)

		for (var pos = 0; pos < map.length; pos++) {
			if (map[input] == pos) return this.toGlobalKey(pos)
		}

		return
	}

	setConfig(config) {
		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			this.Infinitton.setBrightness(config.brightness)
		}

		if (this.config.rotation != config.rotation && config.rotation !== undefined) {
			this.config.rotation = config.rotation
			this.system.emit('device_redraw', this.devicepath)
		}

		if (this.config.page != config.page && config.page !== undefined) {
			this.config.page = config.page

			// also handeled in usb.js
			this.system.emit('device_redraw', this.devicepath)
		}

		this.config = config
	}
}

exports = module.exports = DeviceHardwareInfinitton
