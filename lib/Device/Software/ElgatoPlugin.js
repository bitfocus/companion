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

var DeviceBase = require('../Base')
var debug = require('debug')('Device/Software/ElgatoPlugin')

class DeviceSoftwareElgatoPlugin extends DeviceBase {
	static deviceType = 'StreamDeck Plugin'

	constructor(system, devicepath) {
		super()

		this.system = system

		this.buttonState = []

		this.type = 'Elgato Streamdeck Plugin'
		this.serialnumber = 'plugin'
		this.id = devicepath

		debug('Adding Elgato Streamdeck Plugin')

		this.devicepath = devicepath
		this.keys = {}
		;(this.deviceType = 'StreamDeck Plugin'), (this.config = ['orientation', 'page'])
		this.keysPerRow = 8
		this.keysTotal = 32

		this._config = {
			rotation: 0,
		}

		this.system.once(devicepath + '_plugin_startup', (socket) => {
			this.socket = socket

			this.system.emit('device_ready', devicepath)

			this.socket.on('keydown', (data) => {
				var key = data.keyIndex
				var page = data.page
				var bank = data.bank

				if (key !== undefined) {
					this.buttonState[key].pressed = true
					this.system.emit('device_press', devicepath, key, true, this.buttonState)
				} else if (page !== undefined && bank !== undefined) {
					this.system.emit('bank_pressed', page, bank + 1, true, this.devicepath)
					this.system.emit(
						'log',
						'device(' + this.devicepath + ')',
						'debug',
						'Button ' + page + '.' + (bank + 1) + ' pressed'
					)
				}
			})

			this.socket.on('keyup', (data) => {
				var key = data.keyIndex
				var page = data.page
				var bank = data.bank

				if (key !== undefined) {
					this.buttonState[key].pressed = false
					this.system.emit('device_press', devicepath, key, false, this.buttonState)
				} else if (page !== undefined && bank !== undefined) {
					this.system.emit('bank_pressed', page, bank + 1, false, this.devicepath)
					this.system.emit(
						'log',
						'device(' + this.devicepath + ')',
						'debug',
						'Button ' + page + '.' + (bank + 1) + ' released'
					)
				}
			})
		})

		for (var button = 0; button < global.MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false,
			}
		}
	}

	begin() {}

	clearAllKeys() {
		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			this.keys[i] = Buffer.alloc(15552)

			if (this.socket !== undefined) {
				this.socket.apicommand('fillImage', { keyIndex: i, data: this.keys[i] })
			} else {
				debug('trying to emit to nonexistaant socket: ', this.id)
			}
		}
	}

	clearDeck() {
		debug('elgato.prototype.clearDeck()')
		this.clearAllKeys()
	}

	clearKey(keyIndex) {
		this.keys[keyIndex] = Buffer.alloc(15552)

		if (this.socket !== undefined) {
			this.socket.apicommand('fillImage', { keyIndex: keyIndex, data: this.keys[keyIndex] })
		} else {
			debug('trying to emit to nonexistaant socket: ', this.id)
		}
	}

	draw(key, buffer) {
		if (buffer === undefined || buffer.length != 15552) {
			debug('buffer was not 15552, but ', buffer.length)
			return false
		}

		// TODO: Fix
		var hack = { log: this.debug, config: this._config }
		buffer = this.handleBuffer.call(hack, buffer)

		this.fillImage(key, buffer)

		return true
	}

	fillImage(keyIndex, imageBuffer) {
		if (imageBuffer.length !== 15552) {
			throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length)
		}

		this.keys[keyIndex] = imageBuffer

		if (this.socket !== undefined) {
			this.socket.apicommand('fillImage', { keyIndex: keyIndex, data: imageBuffer })
		} else {
			//debug('trying to emit to nonexistaant socket: ', this.id);
		}
	}

	getConfig(cb) {
		debug('getConfig')

		if (typeof cb == 'function') {
			cb(this._config)
		}

		return this._config
	}

	quit() {
		this.socket.removeAllListeners('keyup')
		this.socket.removeAllListeners('keydown')
	}

	setBrightness(value) {}

	setConfig(config) {
		if (this._config.rotation != config.rotation && config.rotation !== undefined) {
			this._config.rotation = config.rotation
			this.system.emit('device_redraw', this.devicepath)
		}

		if (this.deviceHandler) {
			// Custom override, page should have been inside the deviceconfig object
			if (config.page !== undefined) {
				debug('update page in deviceHandler! ' + (this.deviceHandler !== undefined ? 'yes' : 'no'))
				this.deviceHandler.page = config.page
				this.deviceHandler.updatePagedevice()
			}
		}

		this._config = config

		if (this.deviceHandler) {
			this.deviceconfig = config
			this.deviceHandler.updatedConfig()
		}
	}
}

module.exports = DeviceSoftwareElgatoPlugin
