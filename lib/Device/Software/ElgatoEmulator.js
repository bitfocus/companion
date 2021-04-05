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

var DeviceBase = require('../Base')
var debug = require('debug')('Device/Software/ElgatoEmulator')

class DeviceSoftwareElgatoEmulator extends DeviceBase {
	static deviceType = 'StreamDeck Emulator'

	constructor(system, devicepath) {
		super()

		this.system = system
		this.buttonState = []

		this.type = 'Elgato Streamdeck Emulator'
		this.serialnumber = 'emulator'
		this.id = 'emulator'
		this.keysPerRow = 8
		this.keysTotal = 32

		debug('Adding Elgato Streamdeck Emulator')

		this.devicepath = devicepath
		this.keys = {}

		this.config = []

		this.system.emit('get_userconfig', (obj) => {
			this.config = obj
		})

		this.system.emit('io_get', (io) => {
			this.io = io
		})

		this.system.on('io_connect', (client) => {
			client.on('emul_startup', () => {
				client.emit('emul_controlkeys', this.config['emulator_control_enable'])
				for (var key in this.keys) {
					client.emit('emul_fillImage', key, this.keys[key])
				}
			})

			client.on('emul_down', (keyIndex) => {
				var key = this.reverseButton(keyIndex)

				if (key === undefined) {
					return
				}
				this.buttonState[key].pressed = true
				this.system.emit('device_press', this.devicepath, key, true, this.buttonState)
			})

			client.on('emul_up', (keyIndex) => {
				var key = this.reverseButton(keyIndex)

				if (key === undefined) {
					return
				}
				this.buttonState[key].pressed = false
				this.system.emit('device_press', this.devicepath, key, false, this.buttonState)
			})
		})

		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false,
			}
		}

		setImmediate(() => {
			this.system.emit('device_ready', this.devicepath)
		})
	}

	begin() {}

	clearAllKeys() {
		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			this.keys[keyIndex] = Buffer.alloc(15552)
			this.io.emit('clearKey', keyIndex)
		}
	}

	clearDeck() {
		debug('elgato.prototype.clearDeck()')

		for (var x = 0; x < this.keysTotal; x++) {
			this.clearKey(x)
		}
	}

	clearKey(keyIndex) {
		this.keys[keyIndex] = Buffer.alloc(15552)

		this.io.emit('clearKey', keyIndex)
	}

	draw(key, buffer) {
		if (buffer === undefined || buffer.length != 15552) {
			debug('buffer was not 15552, but ', buffer.length)
			return false
		}
		key = this.mapButton(key)

		if (key >= 0 && !isNaN(key)) {
			this.fillImage(key, buffer)
		}

		return true
	}

	fillImage(keyIndex, imageBuffer) {
		if (imageBuffer.length !== 15552) {
			throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
		}

		this.keys[keyIndex] = imageBuffer

		if (this.io !== undefined) {
			this.io.emit('emul_fillImage', keyIndex, imageBuffer)
		}
	}

	mapButton(input) {
		var map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)
		var devkey = this.toDeviceKey(input)

		if (devkey < 0) {
			return -1
		}

		return parseInt(map[devkey])
	}

	quit() {}

	reverseButton(input) {
		var map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)

		for (var pos = 0; pos < map.length; pos++) {
			if (map[input] == pos) {
				return this.toGlobalKey(pos)
			}
		}

		return
	}

	setBrightness(value) {
		// No reason to emulate this
	}
}

module.exports = DeviceSoftwareElgatoEmulator
