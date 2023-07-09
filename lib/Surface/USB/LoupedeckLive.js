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

import { EventEmitter } from 'events'
import { LoupedeckBufferFormat, LoupedeckModelId, openLoupedeck } from '@loupedeck/node'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import LogController from '../../Log/Controller.js'
import { convertPanelIndexToXY } from '../Util.js'

const loupedeckLiveInfo = {
	totalCols: 8,
	totalRows: 4,

	lcdCols: 4,
	lcdRows: 3,
	lcdXOffset: 2,

	encoders: [
		[0, 0],
		[0, 1],
		[0, 2],
		[7, 0],
		[7, 1],
		[7, 2],
	],
	buttons: [
		[0, 3],
		[1, 3],
		[2, 3],
		[3, 3],
		[4, 3],
		[5, 3],
		[6, 3],
		[7, 3],
	],
}
const loupedeckLiveSInfo = {
	totalCols: 7,
	totalRows: 3,

	lcdCols: 5,
	lcdRows: 3,
	lcdXOffset: 1,

	encoders: [
		[0, 0],
		[0, 1],
	],
	buttons: [
		[0, 2],
		[6, 0],
		[6, 1],
		[6, 2],
	],
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

function buttonToXY(modelInfo, info) {
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

function rotaryToXY(modelInfo, info) {
	const index = modelInfo.encoders[info.index]
	if (info.type === 'rotary' && index !== undefined) {
		return index
	}

	return undefined
}

class SurfaceUSBLoupedeckLive extends EventEmitter {
	constructor(devicepath, loupedeck, modelInfo, serialnumber) {
		super()

		this.logger = LogController.createLogger(`Surface/USB/Loupedeck/${devicepath}`)

		this.loupedeck = loupedeck
		this.modelInfo = modelInfo

		this.config = {
			brightness: 100,
		}

		this.logger.debug(`Adding Loupedeck Live USB device ${devicepath}`)

		this.info = {
			type: `Loupedeck ${this.loupedeck.modelName}`,
			devicepath: devicepath,
			configFields: ['brightness'],
			deviceId: `loupedeck:${serialnumber}`,
		}

		this.gridSize = {
			columns: this.modelInfo.totalCols,
			rows: this.modelInfo.totalRows,
		}

		this.loupedeck.on('error', (error) => {
			this.logger.error(`error: ${error}`)
			this.emit('remove')
		})

		this.loupedeck.on('down', (info) => {
			if (this.modelInfo.lcdAsButtons) {
				this.#emitClick(info.index, true)
			} else {
				const xy = buttonToXY(this.modelInfo, info) ?? rotaryToXY(this.modelInfo, info)
				if (!xy) {
					return
				}

				this.emit('click', ...xy, true)
			}
		})

		this.loupedeck.on('up', (info) => {
			if (this.modelInfo.lcdAsButtons) {
				this.#emitClick(info.index, false)
			} else {
				const xy = buttonToXY(this.modelInfo, info) ?? rotaryToXY(this.modelInfo, info)
				if (!xy) {
					return
				}

				this.emit('click', ...xy, false)
			}
		})
		this.loupedeck.on('rotate', (info, delta) => {
			const xy = rotaryToXY(this.modelInfo, info)
			if (!xy) {
				return
			}

			this.emit('rotate', ...xy, delta == 1)
		})
		this.loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.modelInfo, touch.target.key)
					this.#emitClick(keyIndex, true)
				}
			}
		})
		this.loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.modelInfo, touch.target.key)
					this.#emitClick(keyIndex, false)
				}
			}
		})

		this.loupedeck.on('disconnect', (error) => {
			this.logger.error(`disconnected: ${error}`)
			this.emit('remove')
		})

		this.write_queue = new ImageWriteQueue(this.logger, async (key, buffer) => {
			const width = this.loupedeck.lcdKeySize
			const height = this.loupedeck.lcdKeySize

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
				await this.loupedeck.drawKeyBuffer(key, newbuffer, LoupedeckBufferFormat.RGB)
			} catch (e) {
				this.logger.debug(`fillImage failed after ${attempts} attempts: ${e}`)
				this.emit('remove')
			}
		})
	}

	#emitClick(key, state) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	async #init() {
		this.logger.debug(`Elgato ${this.loupedeck.modelName} detected`)

		// Make sure the first clear happens properly
		await this.loupedeck.blankDevice(true, true)
	}

	static async create(devicepath) {
		const loupedeck = await openLoupedeck(devicepath, { waitForAcks: true })
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

			const serialnumber = await loupedeck.getSerialNumber()

			const self = new SurfaceUSBLoupedeckLive(devicepath, loupedeck, info, serialnumber)

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

	draw(x, y, render) {
		const lcdX = x - this.modelInfo.lcdXOffset
		if (lcdX >= 0 && lcdX < this.modelInfo.lcdCols && y >= 0 && y < this.modelInfo.lcdRows) {
			const button = lcdX + y * this.modelInfo.lcdCols

			this.write_queue.queue(button, render.buffer)
		}

		const buttonIndex = this.modelInfo.buttons.findIndex((btn) => btn[0] == x && btn[1] == y)
		if (buttonIndex >= 0) {
			const color = render.style ? colorToRgb(render.style.bgcolor) : { r: 0, g: 0, b: 0 }

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

export default SurfaceUSBLoupedeckLive
