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

const StreamDeck = require('elgato-stream-deck').openStreamDeck
const common = require('./common')

class elgato_base extends common {
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

		this.debug(`Adding ${type} USB device`, devicepath)

		this.devicepath = devicepath
		this.streamDeck = new StreamDeck(devicepath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})

		this.info = {
			type: `${type} device`,
			devicepath: devicepath,
			config: ['brightness', 'orientation'],
			keysPerRow: this.streamDeck.KEY_COLUMNS,
			keysTotal: this.streamDeck.NUM_KEYS,
		}

		this.info.serialnumber = this.serialnumber = this.streamDeck.getSerialNumber()

		this.system.emit('log', `device(${this.serialnumber})`, 'debug', `${type} detected`)

		// send elgato_base ready message to devices :)
		setImmediate(() => {
			this.system.emit('elgato_ready', devicepath)
		})

		this.streamDeck.on('down', (keyIndex) => {
			let key = this.toGlobalKey(keyIndex)

			this.system.emit('elgato_click', devicepath, key, true)
		})

		this.streamDeck.on('up', (keyIndex) => {
			let key = this.toGlobalKey(keyIndex)

			this.system.emit('elgato_click', devicepath, key, false)
		})

		this.streamDeck.on('error', (error) => {
			console.error(error)
			this.system.emit('elgatodm_remove_device', devicepath)
		})

		this.applyKeyValues()

		this.streamDeck.clearAllKeys()
	}

	setConfig(config) {
		let redraw = false

		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			try {
				this.streamDeck.setBrightness(config.brightness)
			} catch (e) {
				this.system.emit('log', `device(${this.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
			}
		}

		if (this.config.rotation != config.rotation && config.rotation !== undefined) {
			redraw = true
		}

		this.config = config

		return redraw
	}

	quit() {
		const sd = this.streamDeck

		if (sd !== undefined) {
			try {
				this.clearDeck()
			} catch (e) {}

			sd.close()
		}
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
}

exports = module.exports = elgato_base
