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

import openStreamDeck from '@elgato-stream-deck/node'.openStreamDeck
import util from 'util'
import SurfaceBase from '../Base.js'
import sharp from 'sharp'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import debug0 from 'debug'
const setTimeoutPromise = util.promisify(setTimeout)

class SurfaceUSBElgatoStreamDeck extends SurfaceBase {
	debug = debug0('lib/Surface/USB/ElgatoStreamDeck')

	constructor(system, devicepath) {
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

		this.debug(`Adding elgato_streamdeck USB device`, devicepath)

		this.devicepath = devicepath
		this.streamDeck = openStreamDeck(devicepath, {
			// useOriginalKeyOrder: true,
			jpegOptions: {
				quality: 95,
				subsampling: 1, // 422
			},
		})

		this.info = {
			type: `Elgato ${this.streamDeck.PRODUCT_NAME} device`,
			devicepath: devicepath,
			config: ['brightness', 'orientation'],
			keysPerRow: this.streamDeck.KEY_COLUMNS,
			keysTotal: this.streamDeck.NUM_KEYS,
		}

		this.write_queue = new ImageWriteQueue(async (key, buffer) => {
			let newbuffer = buffer
			const targetSize = this.streamDeck.ICON_SIZE
			if (targetSize !== 72) {
				try {
					newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
						.resize(targetSize, targetSize)
						.raw()
						.toBuffer()
				} catch (e) {
					this.system.emit('log', 'device(' + this.serialnumber + ')', 'debug', `scale image failed: ${e}`)
					this.system.emit('elgatodm_remove_device', this.devicepath)
					return
				}
			}

			const maxAttempts = 3
			for (let attempts = 1; attempts <= maxAttempts; attempts++) {
				try {
					this.streamDeck.fillKeyBuffer(key, newbuffer)
					return
				} catch (e) {
					this.system.emit(
						'log',
						'device(' + this.serialnumber + ')',
						'debug',
						`fillImage attempt ${attempts} failed: ${e}`
					)
					if (attempts == maxAttempts) {
						this.system.emit('elgatodm_remove_device', this.devicepath)
						return
					}
					await setTimeoutPromise(20)
				}
			}
		})

		this.streamDeck
			.getSerialNumber()
			.then((serial) => {
				this.info.serialnumber = this.serialnumber = serial
				this.finish_add()

				this.system.emit(
					'log',
					`device(${this.serialnumber})`,
					'debug',
					`Elgato ${this.streamDeck.PRODUCT_NAME} detected`
				)

				// send elgato_base ready message to devices :)
				setImmediate(() => {
					this.system.emit('device_ready', devicepath)
				})

				this.streamDeck.clearPanel().catch((err) => {
					console.error(err)
					this.system.emit('log', `device(${this.serialnumber})`, 'error', `Initial clear failed`)
					this.system.emit('elgatodm_remove_device', devicepath)
				})
			})
			.catch((err) => {
				console.error(err)
				this.system.emit('log', `device(${this.serialnumber})`, 'error', `Get serialnumber failed`)
				this.system.emit('elgatodm_remove_device', devicepath)
			})

		this.streamDeck.on('error', (error) => {
			console.error(error)
			this.system.emit('elgatodm_remove_device', devicepath)
		})

		this.streamDeck.on('down', (keyIndex) => {
			var key = this.toGlobalKey(keyIndex)

			this.system.emit('device_click', devicepath, key, true)
		})

		this.streamDeck.on('up', (keyIndex) => {
			var key = this.toGlobalKey(keyIndex)

			this.system.emit('device_click', devicepath, key, false)
		})

		this.applyKeyValues()
	}

	setConfig(config) {
		let redraw = false

		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			this.streamDeck.setBrightness(config.brightness).catch((e) => {
				this.system.emit('log', `device(${this.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
			})
		}

		if (this.config.rotation != config.rotation && config.rotation !== undefined) {
			redraw = true
		}

		this.config = config

		return redraw
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

	begin() {
		this.log('elgato_base.prototype.begin()')

		this.streamDeck.setBrightness(this.config.brightness).catch((e) => {
			this.system.emit('log', `device(${this.serialnumber})`, 'debug', `Set brightness failed: ${e}`)
		})
	}

	clearDeck() {
		this.log('elgato_base.prototype.clearDeck()')

		this.streamDeck.clearPanel(this.config.brightness).catch((e) => {
			this.system.emit('log', `device(${this.serialnumber})`, 'debug', `Clear deck failed: ${e}`)
		})
	}

	draw(key, buffer, style) {
		const numKeys = this.streamDeck.NUM_KEYS
		const button = this.toDeviceKey(key)
		if (button < 0 || button >= numKeys) {
			return true
		}

		buffer = this.handleBuffer(buffer)

		this.write_queue.queue(button, buffer)

		return true
	}
}

export default SurfaceUSBElgatoStreamDeck
