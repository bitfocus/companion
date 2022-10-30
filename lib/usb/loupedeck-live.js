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

var { openLoupedeck } = require('@loupedeck/node')
var debug = require('debug')('lib/usb/loupedeck-live')
var common = require('./common')
var util = require('util')
var image_write_queue = require('./image-write-queue')
var setTimeoutPromise = util.promisify(setTimeout)
var sharp = require('sharp')

const ButtonIds = ['circle', '1', '2', '3', '4', '5', '6', '7']

function colorToRgb(dec) {
	const r = Math.round((dec & 0xff0000) >> 16)
	const g = Math.round((dec & 0x00ff00) >> 8)
	const b = Math.round(dec & 0x0000ff)

	return { r, g, b }
}

function buttonToIndex(info) {
	if (info.type === 'button') {
		return 24 + info.index
	}

	return undefined
}
const translateTouchKeyIndex = (key) => {
	const x = key % 4
	const y = Math.floor(key / 4)
	return y * 8 + x + 2
}

function rotaryToButtonIndex(info) {
	if (info.type === 'rotary') {
		switch (info.index) {
			case 0:
				return 0
			case 1:
				return 8
			case 2:
				return 16
			case 3:
				return 7
			case 4:
				return 15
			case 5:
				return 23
			default:
				return undefined
		}
	}
}

class LoupedeckLive {
	constructor(system, devicepath) {
		util.inherits(LoupedeckLive, common)

		var self = this
		self.system = system

		self.info = {}
		self.info.devicepath = self.devicepath = devicepath
		self.type = self.info.type = 'Loupedeck ?'
		self.info.config = ['brightness']
		self.info.keysPerRow = 8
		self.info.keysTotal = 32

		self.config = {
			brightness: 100,
		}

		debug('Adding Loupedeck Live USB device', devicepath)

		const connectTimeout = setTimeout(() => {
			self.system.emit('log', `device(${self.serialnumber})`, 'error', `Open Loupedeck timed out`)

			// If device isnt 'connected' after this time, then lets get it removed
			self.system.emit('elgatodm_remove_device', devicepath)
		}, 3000)

		openLoupedeck(devicepath, { waitForAcks: true })
			.then(async (loupedeck) => {
				clearTimeout(connectTimeout)

				self.loupedeck = loupedeck
				self.type = self.info.type = loupedeck.modelName

				const serialnumber = await loupedeck.getSerialNumber()

				self.info.serialnumber = self.serialnumber = serialnumber
				self.finish_add()

				self.system.emit('log', `device(${self.serialnumber})`, 'debug', `Loupedeck Live detected`)

				// send elgato_base ready message to devices :)
				setImmediate(() => {
					self.system.emit('elgato_ready', devicepath)
				})

				self.loupedeck.on('error', function (error) {
					console.error(error)
					system.emit('elgatodm_remove_device', devicepath)
				})

				self.loupedeck.on('down', function (info) {
					const key = buttonToIndex(info) ?? rotaryToButtonIndex(info)
					if (key === undefined) {
						return
					}

					self.system.emit('elgato_click', devicepath, key, true)
				})

				self.loupedeck.on('up', function (info) {
					const key = buttonToIndex(info) ?? rotaryToButtonIndex(info)
					if (key === undefined) {
						return
					}

					self.system.emit('elgato_click', devicepath, key, false)
				})
				self.loupedeck.on('rotate', function (info, delta) {
					if (info.type !== 'rotary') return

					const key = rotaryToButtonIndex(info)
					if (key === undefined) {
						return
					}

					self.system.emit('elgato_rotate', devicepath, key, delta == 1)
				})
				self.loupedeck.on('touchstart', (data) => {
					for (const touch of data.changedTouches) {
						if (touch.target.key !== undefined) {
							self.system.emit('elgato_click', devicepath, translateTouchKeyIndex(touch.target.key), true)
						}
					}
				})
				self.loupedeck.on('touchend', (data) => {
					for (const touch of data.changedTouches) {
						if (touch.target.key !== undefined) {
							self.system.emit('elgato_click', devicepath, translateTouchKeyIndex(touch.target.key), false)
						}
					}
				})

				self.loupedeck.on('disconnect', function (error) {
					console.error(error)
					system.emit('elgatodm_remove_device', devicepath)
				})

				const width = 80
				const height = 80

				self.write_queue = new image_write_queue(async function (key, buffer) {
					let newbuffer
					try {
						newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
							.resize(width, height)
							.raw()
							.toBuffer()
					} catch (e) {
						self.system.emit('log', 'device(' + self.serialnumber + ')', 'debug', `scale image failed: ${e}`)
						self.system.emit('elgatodm_remove_device', self.devicepath)
						return
					}

					try {
						// Get offset x/y for key index
						const x = (key % 4) * 90
						const y = Math.floor(key / 4) * 90

						await self.loupedeck.drawBuffer(
							'center',
							newbuffer,
							'rgb',
							width,
							height,
							x + (90 - width) / 2,
							y + (90 - height) / 2
						)
					} catch (e) {
						self.system.emit(
							'log',
							'device(' + self.serialnumber + ')',
							'error',
							`fillImage failed after ${attempts}: ${e}`
						)
						self.system.emit('elgatodm_remove_device', self.devicepath)
					}
				})

				self.clearDeck()
			})
			.catch((err) => {
				console.error(err)
				self.system.emit('log', `device(${self.serialnumber})`, 'error', `Initialise failed`)
				self.system.emit('elgatodm_remove_device', devicepath)
			})

		return self
	}
	setConfig(config) {
		var self = this

		let redraw = false

		if (self.config.brightness != config.brightness && config.brightness !== undefined) {
			self.loupedeck.setBrightness(config.brightness / 100).catch((e) => {
				self.log(`brightness failed: ${e}`)
			})
		}

		if (self.config.rotation != config.rotation && config.rotation !== undefined) {
			redraw = true
		}

		self.config = config

		return redraw
	}
	quit() {
		var self = this

		var sd = self.loupedeck
		if (sd !== undefined) {
			// try {
			// 	this.clearDeck()
			// } catch (e) {}

			sd.close()
		}
	}
	draw(key, buffer, style) {
		var self = this

		const x = (key % 8) - 2
		const y = Math.floor(key / 8)

		if (x >= 0 && x < 4) {
			const button = x + y * 4

			buffer = self.handleBuffer(buffer)

			self.write_queue.queue(button, buffer)
		}

		if (key >= 24 && key < 32) {
			const id = key - 24
			if (id) {
				const color = style ? colorToRgb(style.bgcolor) : { r: 0, g: 0, b: 0 }

				self.loupedeck
					.setButtonColor({
						id,
						red: color.r,
						green: color.g,
						blue: color.b,
					})
					.catch((e) => {
						self.log(`color failed: ${e}`)
					})
			}
		}

		return true
	}
	begin() {
		var self = this
		self.log('loupedeck.begin()')

		self.loupedeck.setBrightness(self.config.brightness / 100).catch((e) => {
			self.log(`brightness failed: ${e}`)
		})
	}
	clearDeck() {
		var self = this
		self.log('loupedeck.clearDeck()')

		self.loupedeck.blankDevice().catch((e) => {
			self.log(`blank failed: ${e}`)
		})
	}
}

exports = module.exports = LoupedeckLive
