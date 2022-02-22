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

const SurfaceBase = require('../Base')

class SurfaceIPElgatoEmulator extends SurfaceBase {
	debug = require('debug')('lib/Surface/IP/ElgatoEmulator')

	constructor(system, devicepath) {
		super()
		this.system = system

		this.type = 'Elgato Streamdeck Emulator'
		this.serialnumber = 'emulator'
		this.id = 'emulator'
		this.keysPerRow = 8
		this.keysTotal = 32

		this.debug('Adding Elgato Streamdeck Emulator')

		this.devicepath = devicepath
		this.keys = {}

		this.config = []
		this._config = {}

		this.system.emit('get_userconfig', (obj) => {
			this._config = obj
		})

		this.system.emit('io_get', (_io) => {
			this.io = _io
		})

		this.system.on('io_connect', (socket) => {
			socket.on('emul_startup', () => {
				socket.join('emulator')

				socket.emit('emul_controlkeys', this._config['emulator_control_enable'])
				for (let key in this.keys) {
					socket.emit('emul_fillImage', key, this.keys[key])
				}
			})

			socket.on('emul_down', (keyIndex) => {
				let key = this.reverseButton(keyIndex)

				if (key === undefined) {
					return
				}
				this.system.emit('elgato_click', devicepath, key, true)
			})

			socket.on('emul_up', (keyIndex) => {
				let key = this.reverseButton(keyIndex)

				if (key === undefined) {
					return
				}
				this.system.emit('elgato_click', devicepath, key, false)
			})
		})

		setImmediate(() => {
			this.system.emit('elgato_ready', devicepath)
		})
	}

	begin() {}

	quit() {}

	draw(key, buffer, style) {
		if (buffer === undefined || buffer.length != 15552) {
			this.debug('buffer was not 15552, but ', buffer.length)
			return false
		}
		key = this.mapButton(key)

		if (key >= 0 && !isNaN(key)) {
			this.fillImage(key, buffer)
		}

		return true
	}

	mapButton(input) {
		const map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)
		const devkey = this.toDeviceKey(input)
		if (devkey < 0) {
			return -1
		}

		return parseInt(map[devkey])
	}

	reverseButton(input) {
		const map = '7 6 5 4 3 2 1 0 15 14 13 12 11 10 9 8 23 22 21 20 19 18 17 16 31 30 29 28 27 26 25 24'.split(/ /)
		for (let pos = 0; pos < map.length; pos++) {
			if (map[input] == pos) return this.toGlobalKey(pos)
		}

		return
	}

	clearDeck() {
		this.debug('elgato.prototype.clearDeck()')
		for (let x = 0; x < this.keysTotal; x++) {
			this.clearKey(x)
		}
	}

	/* elgato-streamdeck functions */

	fillImage(keyIndex, imageBuffer) {
		if (imageBuffer.length !== 15552) {
			throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
		}

		this.keys[keyIndex] = imageBuffer

		this.io.emitToRoom('emulator', 'emul_fillImage', keyIndex, imageBuffer)
	}

	clearKey(keyIndex) {
		this.keys[keyIndex] = Buffer.alloc(15552)

		this.io.emitToRoom('emulator', 'emul_clearKey', keyIndex)
	}
}

module.exports = SurfaceIPElgatoEmulator
