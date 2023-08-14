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

import { LoupedeckBufferFormat, LoupedeckModelId, openLoupedeck } from '@loupedeck/node'
import util from 'util'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
const setTimeoutPromise = util.promisify(setTimeout)
import sharp from 'sharp'

const loupedeckLiveInfo = {
	totalCols: 8,
	totalRows: 4,

	lcdCols: 4,
	lcdRows: 3,
	lcdXOffset: 2,

	encoders: [0, 8, 16, 7, 15, 23],
	buttons: [24, 25, 26, 27, 28, 29, 30, 31],
}
const loupedeckLiveSInfo = {
	totalCols: 7,
	totalRows: 3,

	lcdCols: 5,
	lcdRows: 3,
	lcdXOffset: 1,

	encoders: [0, 7],
	buttons: [14, 6, 13, 20],
}
const razerStreamControllerXInfo = {
	totalCols: 5,
	totalRows: 3,

	lcdCols: 5,
	lcdRows: 3,
	lcdXOffset: 0,
	lcdAsButtons: true,

	encoders: [],
	buttons: [],
}

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
const translateTouchKeyIndex = (modelInfo, key) => {
	const x = key % modelInfo.lcdCols
	const y = Math.floor(key / modelInfo.lcdCols)
	return y * modelInfo.totalCols + x + modelInfo.lcdXOffset
}

function rotaryToButtonIndex(modelInfo, info) {
	const index = modelInfo.encoders[info.index]
	if (info.type === 'rotary' && index !== undefined) {
		return index
	}

	return undefined
}

class SurfaceUSBLoupedeckLive {
	constructor(ipcWrapper, devicePath, loupedeck, modelInfo, serialNumber) {
		this.ipcWrapper = ipcWrapper
		this.loupedeck = loupedeck
		this.modelInfo = modelInfo

		this.config = {
			brightness: 100,
		}

		this.ipcWrapper.log('debug', `Adding Loupedeck Live USB device ${devicePath}`)

		this.info = {
			type: `Loupedeck ${this.loupedeck.modelName}`,
			devicePath: devicePath,
			configFields: ['brightness'],
			keysPerRow: this.modelInfo.totalCols,
			keysTotal: this.modelInfo.totalCols * this.modelInfo.totalRows,
			deviceId: `loupedeck:${serialNumber}`,
		}

		this.loupedeck.on('error', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})

		this.loupedeck.on('down', (info) => {
			if (this.modelInfo.lcdAsButtons) {
				this.ipcWrapper.click(info.index, true)
			} else {
				const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
				if (keyIndex === undefined) {
					return
				}

				this.ipcWrapper.click(keyIndex, true)
			}
		})

		this.loupedeck.on('up', (info) => {
			if (this.modelInfo.lcdAsButtons) {
				this.ipcWrapper.click(info.index, false)
			} else {
				const keyIndex = buttonToIndex(this.modelInfo, info) ?? rotaryToButtonIndex(this.modelInfo, info)
				if (keyIndex === undefined) {
					return
				}

				this.ipcWrapper.click(keyIndex, false)
			}
		})
		this.loupedeck.on('rotate', (info, delta) => {
			const keyIndex = rotaryToButtonIndex(this.modelInfo, info)
			if (keyIndex === undefined) {
				return
			}

			this.ipcWrapper.rotate(keyIndex, delta == 1)
		})
		this.loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.modelInfo, touch.target.key)
					this.ipcWrapper.click(keyIndex, true)
				}
			}
		})
		this.loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.modelInfo, touch.target.key)
					this.ipcWrapper.click(keyIndex, false)
				}
			}
		})

		this.loupedeck.on('disconnect', (error) => {
			console.error(error)
			this.ipcWrapper.remove()
		})

		this.write_queue = new ImageWriteQueue(this.ipcWrapper, async (key, buffer) => {
			const width = this.loupedeck.lcdKeySize
			const height = this.loupedeck.lcdKeySize

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
				await this.loupedeck.drawKeyBuffer(key, newbuffer, LoupedeckBufferFormat.RGB)
			} catch (e) {
				this.ipcWrapper.log('debug', `fillImage failed after ${attempts} attempts: ${e}`)
				this.ipcWrapper.remove()
			}
		})
	}

	async #init() {
		this.ipcWrapper.log('debug', `Elgato ${this.loupedeck.modelName} detected`)

		// Make sure the first clear happens properly
		await this.loupedeck.blankDevice(true, true)
	}

	static async create(ipcWrapper, devicePath) {
		const loupedeck = await openLoupedeck(devicePath, { waitForAcks: true })
		try {
			let info = null
			switch (loupedeck.modelId) {
				case LoupedeckModelId.LoupedeckLive:
					info = loupedeckLiveInfo
					break
				case LoupedeckModelId.LoupedeckLiveS:
					info = loupedeckLiveSInfo
					break
				case LoupedeckModelId.RazerStreamControllerX:
					info = razerStreamControllerXInfo
					break
			}
			if (!info) {
				throw new Error('Unsupported model ')
			}

			const serialNumber = await loupedeck.getSerialNumber()

			const self = new SurfaceUSBLoupedeckLive(ipcWrapper, devicePath, loupedeck, info, serialNumber)

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
		const x = (key % this.modelInfo.totalCols) - this.modelInfo.lcdXOffset
		const y = Math.floor(key / this.modelInfo.totalCols)

		if (x >= 0 && x < this.modelInfo.lcdCols && y >= 0 && y < this.modelInfo.lcdRows) {
			const button = x + y * this.modelInfo.lcdCols

			this.write_queue.queue(button, buffer)
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
					this.ipcWrapper.log('debug', `color failed: ${e}`)
				})
		}

		return true
	}

	clearDeck() {
		this.ipcWrapper.log('debug', 'loupedeck.clearDeck()')

		this.loupedeck.blankDevice(true, true).catch((e) => {
			this.ipcWrapper.log('debug', `blank failed: ${e}`)
		})
	}
}

export default SurfaceUSBLoupedeckLive
