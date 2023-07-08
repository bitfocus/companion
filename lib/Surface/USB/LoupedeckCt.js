/*
 * This file is part of the Companion project
 * Copyright (c) 2023 Bitfocus AS
 * Authors: Dorian Meid <dnmeid@gmx.net>
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

import { EventEmitter } from 'events'
import { LoupedeckBufferFormat, LoupedeckDisplayId, LoupedeckModelId, openLoupedeck } from '@loupedeck/node'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import LogController from '../../Log/Controller.js'

function colorToRgb(dec) {
	const r = Math.round((dec & 0xff0000) >> 16)
	const g = Math.round((dec & 0x00ff00) >> 8)
	const b = Math.round(dec & 0x0000ff)

	return { r, g, b }
}

function buttonToIndex(modelInfo, info) {
	const index = modelInfo.buttons[info.index]
	if (info.type === 'button' && index !== undefined) {
		return index
	}

	return undefined
}
const translateTouchKeyIndex = (transform, key) => {
	const x = key % transform.lcdCols
	const y = Math.floor(key / transform.lcdCols)
	return y * 8 + x + transform.lcdXOffset + transform.lcdYOffset * 8
}

function rotaryToButtonIndex(modelInfo, info) {
	const index = modelInfo.encoders[info.index]
	if (info.type === 'rotary' && index !== undefined) {
		return index
	}

	return undefined
}

class SurfaceUSBLoupedeckCt extends EventEmitter {
	constructor(devicepath, loupedeck, modelInfo, serialnumber) {
		super()

		this.logger = LogController.createLogger(`Surface/USB/Loupedeck/${devicepath}`)

		this.loupedeck = loupedeck
		this.modelInfo = modelInfo

		this.config = {
			brightness: 100,
		}

		this.logger.debug(`Adding Loupedeck CT USB device ${devicepath}`)

		this.info = {
			type: `Loupedeck CT`,
			devicepath: devicepath,
			configFields: ['brightness'],
			keysPerRow: 8,
			keysTotal: 56,
			deviceId: `loupedeck:${serialnumber}`,
		}

		this.loupedeck.on('error', (error) => {
			this.logger.error(`error: ${error}`)
			this.emit('remove')
		})

		this.loupedeck.on('down', (info) => {
			if (this.modelInfo.lcdAsButtons) {
				this.emit('click', info.index, true)
			} else {
				const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
				if (keyIndex === undefined) {
					return
				}
				const pageOffset = Math.floor(keyIndex / global.MAX_BUTTONS)
				this.emit('click', keyIndex % global.MAX_BUTTONS, true, pageOffset)
			}
		})

		this.loupedeck.on('up', (info) => {
			if (this.modelInfo.lcdAsButtons) {
				this.emit('click', info.index, false)
			} else {
				const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
				if (keyIndex === undefined) {
					return
				}
				const pageOffset = Math.floor(keyIndex / global.MAX_BUTTONS)
				this.emit('click', keyIndex % global.MAX_BUTTONS, false, pageOffset)
			}
		})

		this.loupedeck.on('rotate', (info, delta) => {
			const keyIndex = rotaryToButtonIndex(this.modelInfo, info)
			if (keyIndex === undefined) {
				return
			}
			const pageOffset = Math.floor(keyIndex / global.MAX_BUTTONS)
			this.emit('rotate', keyIndex % global.MAX_BUTTONS, delta == 1, pageOffset)
		})

		this.loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.modelInfo.displays[touch.target.screen], touch.target.key)
					const pageOffset = Math.floor(keyIndex / global.MAX_BUTTONS)
					this.emit('click', keyIndex % global.MAX_BUTTONS, true, pageOffset)
				} else if (touch.target.screen == LoupedeckDisplayId.Wheel) {
					this.emit('click', 3, true, 1)
				}
			}
		})

		this.loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.modelInfo.displays[touch.target.screen], touch.target.key)
					const pageOffset = Math.floor(keyIndex / global.MAX_BUTTONS)
					this.emit('click', keyIndex % global.MAX_BUTTONS, false, pageOffset)
				} else if (touch.target.screen == LoupedeckDisplayId.Wheel) {
					this.emit('click', 3, false, 1)
				}
			}
		})

		/**
		 * Map the right touch strip to X-Keys T-Bar variable and left to X-Keys Shuttle variable
		 * this isn't the final thing but at least makes use of the strip while waiting for a better solution
		 * no multitouch support, the last moved touch wins
		 * lock will not be obeyed
		 */
		this.loupedeck.on('touchmove', async (data) => {
			let touch = data.changedTouches.find(
				(touch) => touch.target.screen == LoupedeckDisplayId.Right || touch.target.screen == LoupedeckDisplayId.Left
			)
			if (touch && touch.target.screen == LoupedeckDisplayId.Right) {
				const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
				this.emit('xkeys-setVariable', 't-bar', val)
				try {
					await this.loupedeck.drawSolidColour(
						LoupedeckDisplayId.Right,
						{ red: 0, green: 0, blue: 0 },
						60,
						val + 7,
						0,
						0
					)
					await this.loupedeck.drawSolidColour(
						LoupedeckDisplayId.Right,
						{ red: 0, green: 127, blue: 0 },
						60,
						262 - val,
						0,
						val + 7
					)
				} catch (err) {
					this.logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + err)
				}
			} else if (touch && touch.target.screen == LoupedeckDisplayId.Left) {
				const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
				this.emit('xkeys-setVariable', 'shuttle', val)
				try {
					await this.loupedeck.drawSolidColour(
						LoupedeckDisplayId.Left,
						{ red: 0, green: 0, blue: 0 },
						60,
						val + 7,
						0,
						0
					)
					await this.loupedeck.drawSolidColour(
						LoupedeckDisplayId.Left,
						{ red: 127, green: 0, blue: 0 },
						60,
						262 - val,
						0,
						val + 7
					)
				} catch (err) {
					this.logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + err)
				}
			}
		})

		this.loupedeck.on('disconnect', (error) => {
			this.logger.error(`disconnected: ${error}`)
			this.emit('remove')
		})

		this.key_write_queue = new ImageWriteQueue(this.logger, async (key, buffer) => {
			let width = this.loupedeck.lcdKeySize
			let height = this.loupedeck.lcdKeySize

			if (key === 35) {
				width = 240
				height = 240
			}

			// const rotation = translateRotation(this.config.rotation)

			let newbuffer
			try {
				let imagesize = Math.sqrt(buffer.length / 4) // TODO: assuming here that the image is square
				let image = imageRs.ImageTransformer.fromBuffer(buffer, imagesize, imagesize, imageRs.PixelFormat.Rgba).scale(
					width,
					height
				)

				// const rotation = translateRotation(this.config.rotation)
				// if (rotation !== null) image = image.rotate(rotation)

				newbuffer = Buffer.from(await image.toBuffer(imageRs.PixelFormat.Rgb))
			} catch (e) {
				this.logger.debug(`scale image failed: ${e}`)
				this.emit('remove')
				return
			}

			try {
				if (key !== 35) {
					await this.loupedeck.drawKeyBuffer(key, newbuffer, LoupedeckBufferFormat.RGB)
				} else {
					await this.loupedeck.drawBuffer(
						LoupedeckDisplayId.Wheel,
						newbuffer,
						LoupedeckBufferFormat.RGB,
						240,
						240,
						0,
						0
					)
				}
			} catch (e) {
				this.logger.debug(`fillImage failed after ${attempts} attempts: ${e}`)
				this.emit('remove')
			}
		})
	}

	async #init() {
		this.logger.debug(`Loupedeck ${this.loupedeck.modelName} detected`)

		// Make sure the first clear happens properly
		await this.loupedeck.blankDevice(true, true)
	}

	static async create(devicepath) {
		const loupedeck = await openLoupedeck(devicepath, { waitForAcks: true })
		try {
			const info = {
				totalCols: 8,
				totalRows: 7,

				displays: {
					center: {
						lcdCols: 4,
						lcdRows: 3,
						lcdXOffset: 2,
						lcdYOffset: 0,
					},
					wheel: {
						lcdCols: 1,
						lcdRows: 1,
						lcdXOffset: 3,
						lcdYOffset: 5,
					},
				},

				encoders: [0, 8, 16, 7, 15, 23, 35],
				buttons: [24, 25, 26, 27, 28, 29, 30, 31, 32, 40, 48, 33, 41, 49, 38, 46, 54, 39, 47, 55],
			}

			const serialnumber = await loupedeck.getSerialNumber()

			const self = new SurfaceUSBLoupedeckCt(devicepath, loupedeck, info, serialnumber)

			await self.#init()

			return self
		} catch (e) {
			loupedeck.close()

			throw e
		}
	}

	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.loupedeck.setBrightness(config.brightness / 100).catch((e) => {
				this.logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit() {
		try {
			this.clearDeck()
		} catch (e) {}

		this.loupedeck.close()
	}

	draw(key, buffer, style) {
		let screen = this.modelInfo.displays.center
		const x = (key % this.modelInfo.totalCols) - screen.lcdXOffset
		const y = Math.floor(key / this.modelInfo.totalCols)

		if (x >= 0 && x < screen.lcdCols && y >= 0 && y < screen.lcdRows) {
			const button = x + y * screen.lcdCols

			this.key_write_queue.queue(button, buffer)
		} else if (key == 35) {
			this.key_write_queue.queue(35, buffer)
		}

		const buttonIndex = this.modelInfo.buttons.indexOf(key)
		if (buttonIndex >= 0) {
			const color = style ? colorToRgb(style.bgcolor) : { r: 0, g: 0, b: 0 }

			this.loupedeck
				.setButtonColor({
					id: buttonIndex,
					red: color.r,
					green: color.g,
					blue: color.b,
				})
				.catch((e) => {
					this.logger.debug(`color failed: ${e}`)
				})
		}

		return true
	}

	clearDeck() {
		this.logger.debug('loupedeck.clearDeck()')

		this.loupedeck.blankDevice(true, true).catch((e) => {
			this.logger.debug(`blank failed: ${e}`)
		})
	}
}

export default SurfaceUSBLoupedeckCt
