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
var DeviceBase = require('../Base')

class DeviceHardwareElgatoBase extends DeviceBase {
	constructor(system, devicepath, type) {
		super()
		this.system = system

		this.config = {
			brightness: 100,
			rotation: 0,
			page: 1,
		}

		process.on('uncaughtException', (err) => {
			this.system.emit('log', `device(${this.serialnumber})`, 'debug', `uncaughtException: ${err}`)
		})
		process.on('unhandledRejection', (err) => {
			this.system.emit('log', `device(${this.serialnumber})`, 'debug', `unhandledRejection: ${err}`)
		})

		debug(`Adding ${type} USB device`, devicepath)

		this.devicepath = devicepath
		this.streamDeck = new StreamDeck(devicepath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})
		this.buttonState = []

		this.info = {
			type: `${type} device`,
			devicepath: devicepath,
			deviceType: 'StreamDeck',
			config: ['brightness', 'orientation', 'page'],
			keysPerRow: this.streamDeck.KEY_COLUMNS,
			keysTotal: this.streamDeck.NUM_KEYS,
		}

		this.info.serialnumber = this.serialnumber = this.streamDeck.getSerialNumber()

		this.checkKeyValues()

		this.system.emit('log', `device(${this.serialnumber})`, 'debug', `${type} detected`)

		// send elgato_base ready message to devices :)
		setImmediate(() => {
			this.system.emit('device_ready', devicepath)
		})

		this.streamDeck.on('down', (keyIndex) => {
			var key = this.toGlobalKey(keyIndex)

			this.buttonState[key].pressed = true
			this.system.emit('device_press', devicepath, key, true, this.buttonState)
		})

		this.streamDeck.on('up', (keyIndex) => {
			var key = this.toGlobalKey(keyIndex)

			this.buttonState[key].pressed = false
			this.system.emit('device_press', devicepath, key, false, this.buttonState)
		})

		this.streamDeck.on('error', (error) => {
			console.error(error)
			this.system.emit('device_remove', devicepath)
		})

		// Initialize button state hash
		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false,
			}
		}

		this.streamDeck.clearAllKeys()
	}

	begin() {
		this.log('elgato_base.prototype.begin()')

		try {
			this.streamDeck.setBrightness(this.config.brightness)
		} catch (e) {
			this.system.emit('log', `device(${this.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
		}
	}

	clearDeck() {
		this.log('elgato_base.prototype.clearDeck()')

		try {
			this.streamDeck.clearAllKeys()
		} catch (e) {
			this.system.emit('log', `device(${this.serialnumber})`, 'debug', `Clear deck failed: ${e}`)
		}
	}

	quit() {
		var sd = this.streamDeck

		if (sd !== undefined) {
			try {
				this.clearDeck()
			} catch (e) {}

			sd.close()
		}
	}

	setConfig(config) {
		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			try {
				this.streamDeck.setBrightness(config.brightness)
			} catch (e) {
				this.system.emit('log', `device(${this.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
			}
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

exports = module.exports = DeviceHardwareElgatoBase
