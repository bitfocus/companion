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

import { openLoupedeck } from '@loupedeck/node'
import util from 'util'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
const setTimeoutPromise = util.promisify(setTimeout)
import sharp from 'sharp'

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
				return 1
			case 1:
				return 9
			case 2:
				return 17
			case 3:
				return 6
			case 4:
				return 14
			case 5:
				return 22
			default:
				return undefined
		}
	}
}

class SurfaceUSBLoupedeckLive {
	constructor(ipcWrapper, devicepath, loupedeck, serialnumber) {
		this.ipcWrapper = ipcWrapper
		this.loupedeck = loupedeck

		this.config = {
			brightness: 100,
		}

		this.ipcWrapper.log('debug', `Adding Loupedeck Live USB device ${devicepath}`)

		this.info = {
			type: `Loupedeck ${this.loupedeck.modelName}`,
			devicepath: devicepath,
			configFields: ['brightness'],
			keysPerRow: 8,
			keysTotal: 32,
			serialnumber: serialnumber,
		}

		this.loupedeck.on('error', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})

		this.loupedeck.on('down', (info) => {
			const keyIndex = buttonToIndex(info) ?? rotaryToButtonIndex(info)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.click(keyIndex, true)
		})

		this.loupedeck.on('up', (info) => {
			const keyIndex = buttonToIndex(info) ?? rotaryToButtonIndex(info)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.click(keyIndex, false)
		})
		this.loupedeck.on('rotate', (info, delta) => {
			if (info.type !== 'rotary') return

			let keyIndex = undefined
			switch (info.index) {
				case 0:
					keyIndex = 0
					break
				case 1:
					keyIndex = 8
					break
				case 2:
					keyIndex = 16
					break
				case 3:
					keyIndex = 7
					break
				case 4:
					keyIndex = 15
					break
				case 5:
					keyIndex = 23
					break
			}

			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.click(keyIndex, delta == 1)
		})
		this.loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(touch.target.key)
					this.ipcWrapper.click(keyIndex, true)
				}
			}
		})
		this.loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(touch.target.key)
					this.ipcWrapper.click(keyIndex, false)
				}
			}
		})

		this.loupedeck.on('disconnect', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})

		this.write_queue = new ImageWriteQueue(this.ipcWrapper, async (key, buffer) => {
			const width = 80
			const height = 80

			let newbuffer
			try {
				newbuffer = await sharp(buffer, { raw: { width: 72, height: 72, channels: 3 } })
					.resize(width, height)
					.raw()
					.toBuffer()
			} catch (e) {
				this.ipcWrapper.log('debug', `scale image failed: ${e}`)
				this.ipcWrapper.remove()
				return
			}

			try {
				// Get offset x/y for key index
				const x = (key % 4) * 90
				const y = Math.floor(key / 4) * 90

				await this.loupedeck.drawBuffer(
					'center',
					newbuffer,
					'rgb',
					width,
					height,
					x + (90 - width) / 2,
					y + (90 - height) / 2
				)
			} catch (e) {
				this.ipcWrapper.log('debug', `fillImage failed after ${attempts} attempts: ${e}`)
				this.ipcWrapper.remove()
			}
		})
	}

	async #init() {
		this.ipcWrapper.log('debug', `Elgato ${this.loupedeck.modelName} detected`)

		// Make sure the first clear happens properly
		await this.loupedeck.blankDevice()
	}

	static async create(ipcWrapper, devicepath) {
		const loupedeck = await openLoupedeck(devicepath, { waitForAcks: true })
		const serialnumber = await loupedeck.getSerialNumber()

		const self = new SurfaceUSBLoupedeckLive(ipcWrapper, devicepath, loupedeck, serialnumber)

		await self.#init()

		return self
	}

	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.loupedeck.setBrightness(config.brightness / 100).catch((e) => {
				this.ipcWrapper.log('debug', `Set brightness failed: ${e}`)
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
		const x = (key % 8) - 2
		const y = Math.floor(key / 8)

		if (x >= 0 && x < 4) {
			const button = x + y * 4

			this.write_queue.queue(button, buffer)
		}

		if (key >= 24 && key < 32) {
			const id = key - 24
			if (id) {
				const color = style ? colorToRgb(style.bgcolor) : { r: 0, g: 0, b: 0 }

				this.loupedeck
					.setButtonColor({
						id,
						red: color.r,
						green: color.g,
						blue: color.b,
					})
					.catch((e) => {
						this.ipcWrapper.log('debug', `color failed: ${e}`)
					})
			}
		}

		return true
	}

	clearDeck() {
		this.ipcWrapper.log('debug', 'loupedeck.clearDeck()')

		this.loupedeck.blankDevice().catch((e) => {
			this.ipcWrapper.log('debug', `blank failed: ${e}`)
		})
	}
}

export default SurfaceUSBLoupedeckLive
