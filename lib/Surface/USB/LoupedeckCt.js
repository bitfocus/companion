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
import { LoupedeckBufferFormat, LoupedeckDisplayId, openLoupedeck } from '@loupedeck/node'
import { convertPanelIndexToXY } from '../Util.js'
import { translateRotation } from '../../Resources/Util.js'
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import LogController from '../../Log/Controller.js'

/**
 * @typedef {{
 *   lcdCols: number
 *   lcdRows: number
 *   lcdXOffset: number
 *   lcdYOffset: number
 * }} DisplayInfo
 *
 * @typedef {{
 *   totalCols: number
 *   totalRows: number
 *   displays: Record<string, DisplayInfo>
 *   encoders: Array<[x: number, y: number]>
 *   buttons: Array<[x: number, y: number]>
 * }} ModelInfo
 */

/**
 * Convert a number to rgb components
 * @param {number} dec
 * @returns {{ r: number, g: number, b: number }}
 */
function colorToRgb(dec) {
	const r = Math.round((dec & 0xff0000) >> 16)
	const g = Math.round((dec & 0x00ff00) >> 8)
	const b = Math.round(dec & 0x0000ff)

	return { r, g, b }
}

/**
 * Convert a loupedeck control to x/y coordinates
 * @param {ModelInfo} modelInfo
 * @param {import('@loupedeck/node').LoupedeckControlInfo} info
 * @returns {[x: number, y: number] | undefined}
 */
function buttonToXY(modelInfo, info) {
	const index = modelInfo.buttons[info.index]
	if (info.type === 'button' && index !== undefined) {
		return index
	}

	return undefined
}
/**
 * Convert a loupedeck lcd x/y coordinate to companion x/y coordinates
 * @param {DisplayInfo} displayInfo
 * @param {number} key
 * @returns {number}
 */
const translateTouchKeyIndex = (displayInfo, key) => {
	const x = key % displayInfo.lcdCols
	const y = Math.floor(key / displayInfo.lcdCols)
	return y * 8 + x + displayInfo.lcdXOffset + displayInfo.lcdYOffset * 8
}

/**
 * Convert a loupedeck control to x/y coordinates
 * @param {ModelInfo} modelInfo
 * @param {import('@loupedeck/node').LoupedeckControlInfo} info
 * @returns {[x: number, y: number] | undefined}
 */
function rotaryToXY(modelInfo, info) {
	const index = modelInfo.encoders[info.index]
	if (info.type === 'rotary' && index !== undefined) {
		return index
	}

	return undefined
}

class SurfaceUSBLoupedeckCt extends EventEmitter {
	/**
	 * Loupdeck device handle
	 * @type {import('@loupedeck/node').LoupedeckDevice}
	 * @access private
	 */
	#loupedeck

	/**
	 * Information about the current loupedeck model
	 * @type {ModelInfo}
	 * @access private
	 */
	#modelInfo

	/**
	 * @type {ImageWriteQueue}
	 * @access private
	 */
	#writeQueue

	/**
	 * @type {Record<string, any>}
	 * @access private
	 */
	config

	/**
	 *
	 * @param {string} devicePath
	 * @param {import('@loupedeck/node').LoupedeckDevice} loupedeck
	 * @param {ModelInfo} modelInfo
	 * @param {string} serialNumber
	 */
	constructor(devicePath, loupedeck, modelInfo, serialNumber) {
		super()

		this.logger = LogController.createLogger(`Surface/USB/Loupedeck/${devicePath}`)

		this.#loupedeck = loupedeck
		this.#modelInfo = modelInfo

		this.config = {
			brightness: 100,
		}

		this.logger.debug(`Adding Loupedeck CT USB device ${devicePath}`)

		this.info = {
			type: `Loupedeck CT`,
			devicePath: devicePath,
			configFields: ['brightness'],
			deviceId: `loupedeck:${serialNumber}`,
		}

		this.gridSize = {
			columns: 8,
			rows: 7,
		}

		this.#loupedeck.on('error', (error) => {
			this.logger.error(`error: ${error}`)
			this.emit('remove')
		})

		this.#loupedeck.on('down', (info) => {
			const xy = buttonToXY(this.#modelInfo, info) ?? rotaryToXY(this.#modelInfo, info)

			this.#emitClick(xy, true)
		})

		this.#loupedeck.on('up', (info) => {
			const xy = buttonToXY(this.#modelInfo, info) ?? rotaryToXY(this.#modelInfo, info)
			this.#emitClick(xy, false)
		})

		this.#loupedeck.on('rotate', (info, delta) => {
			const xy = rotaryToXY(this.#modelInfo, info)
			if (!xy) return

			this.emit('rotate', xy[0], xy[1], delta == 1)
		})

		this.#loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.#modelInfo.displays[touch.target.screen], touch.target.key)
					const xy = convertPanelIndexToXY(keyIndex, this.gridSize)
					this.#emitClick(xy, true)
				} else if (touch.target.screen == LoupedeckDisplayId.Wheel) {
					this.#emitClick([2, 4], true)
				}
			}
		})

		this.#loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.#modelInfo.displays[touch.target.screen], touch.target.key)
					const xy = convertPanelIndexToXY(keyIndex, this.gridSize)
					this.#emitClick(xy, false)
				} else if (touch.target.screen == LoupedeckDisplayId.Wheel) {
					this.#emitClick([2, 4], false)
				}
			}
		})

		/**
		 * Map the right touch strip to X-Keys T-Bar variable and left to X-Keys Shuttle variable
		 * this isn't the final thing but at least makes use of the strip while waiting for a better solution
		 * no multitouch support, the last moved touch wins
		 * lock will not be obeyed
		 */
		this.#loupedeck.on('touchmove', async (data) => {
			let touch = data.changedTouches.find(
				(touch) => touch.target.screen == LoupedeckDisplayId.Right || touch.target.screen == LoupedeckDisplayId.Left
			)
			if (touch && touch.target.screen == LoupedeckDisplayId.Right) {
				const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
				this.emit('setVariable', 't-bar', val)
				try {
					await this.#loupedeck.drawSolidColour(
						LoupedeckDisplayId.Right,
						{ red: 0, green: 0, blue: 0 },
						60,
						val + 7,
						0,
						0
					)
					await this.#loupedeck.drawSolidColour(
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
				this.emit('setVariable', 'shuttle', val)
				try {
					await this.#loupedeck.drawSolidColour(
						LoupedeckDisplayId.Left,
						{ red: 0, green: 0, blue: 0 },
						60,
						val + 7,
						0,
						0
					)
					await this.#loupedeck.drawSolidColour(
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

		// @ts-ignore
		this.#loupedeck.on('disconnect', (error) => {
			this.logger.error(`disconnected: ${error}`)
			this.emit('remove')
		})

		this.#writeQueue = new ImageWriteQueue(
			this.logger,
			async (/** @type {number} */ key, /** @type {import('../../Graphics/ImageResult.js').ImageResult} */ render) => {
				let width = this.#loupedeck.lcdKeySize
				let height = this.#loupedeck.lcdKeySize

				if (key === 35) {
					width = 240
					height = 240
				}

				// const rotation = translateRotation(this.config.rotation)

				let newbuffer
				try {
					let image = imageRs.ImageTransformer.fromBuffer(
						render.buffer,
						render.bufferWidth,
						render.bufferHeight,
						imageRs.PixelFormat.Rgba
					).scale(width, height)

					const rotation = translateRotation(this.config.rotation)
					if (rotation !== null) image = image.rotate(rotation)

					newbuffer = await image.toBuffer(imageRs.PixelFormat.Rgb)
				} catch (e) {
					this.logger.debug(`scale image failed: ${e}`)
					this.emit('remove')
					return
				}

				try {
					if (key !== 35) {
						await this.#loupedeck.drawKeyBuffer(key, newbuffer, LoupedeckBufferFormat.RGB)
					} else {
						await this.#loupedeck.drawBuffer(
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
					this.logger.debug(`fillImage failed after: ${e}`)
					this.emit('remove')
				}
			}
		)
	}
	/**
	 * Produce a click event
	 * @param {[x: number, y: number] | null | undefined} xy
	 * @param {boolean} state
	 */
	#emitClick(xy, state) {
		if (!xy) return

		const x = xy[0]
		const y = xy[1]

		this.emit('click', x, y, state)
	}

	async #init() {
		this.logger.debug(`${this.#loupedeck.modelName} detected`)

		// Make sure the first clear happens properly
		await this.#loupedeck.blankDevice(true, true)
	}

	/**
	 * Open a loupedeck CT
	 * @param {string} devicePath
	 * @returns {Promise<SurfaceUSBLoupedeckCt>}
	 */
	static async create(devicePath) {
		const loupedeck = await openLoupedeck(devicePath)
		try {
			/** @type {ModelInfo} */
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

				encoders: [
					[0, 0],
					[0, 1],
					[0, 2],
					[7, 0],
					[7, 1],
					[7, 2],
					// wheel
					[2, 4],
				],
				buttons: [
					// row 1-8
					[0, 3],
					[1, 3],
					[2, 3],
					[3, 3],
					[4, 3],
					[5, 3],
					[6, 3],
					[7, 3],
					// home, undo, keyboard
					[0, 4],
					[0, 5],
					[0, 6],
					// return, save, left fn
					[1, 4],
					[1, 5],
					[1, 6],
					// up, left, right fn
					[6, 4],
					[6, 5],
					[6, 6],
					// down, right, E
					[7, 4],
					[7, 5],
					[7, 6],
				],
			}

			const serialNumber = await loupedeck.getSerialNumber()

			const self = new SurfaceUSBLoupedeckCt(devicePath, loupedeck, info, serialNumber)

			await self.#init()

			return self
		} catch (e) {
			loupedeck.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {Record<string, any>} config
	 * @param {boolean=} force
	 * @returns false when nothing happens
	 */
	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#loupedeck.setBrightness(config.brightness / 100).catch((e) => {
				this.logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit() {
		try {
			this.clearDeck()
		} catch (e) {}

		this.#loupedeck.close()
	}

	/**
	 * Draw a button
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	draw(x, y, render) {
		let screen = this.#modelInfo.displays.center
		const lcdX = x - screen.lcdXOffset

		if (x === 3 && y === 4) {
			this.#writeQueue.queue(35, render.buffer)
		} else if (lcdX >= 0 && lcdX < screen.lcdCols && y >= 0 && y < screen.lcdRows) {
			const button = lcdX + y * screen.lcdCols
			this.#writeQueue.queue(button, render.buffer)
		}

		const buttonIndex = this.#modelInfo.buttons.findIndex((btn) => btn[0] == x && btn[1] == y)
		if (buttonIndex >= 0) {
			let color = { r: 0, g: 0, b: 0 }
			if (render.style === 'pageup') color = { r: 255, g: 255, b: 255 }
			else if (render.style === 'pagedown') color = { r: 0, g: 0, b: 255 }
			else if (render.style) color = colorToRgb(render.bgcolor)

			this.#loupedeck
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
	}

	clearDeck() {
		this.logger.debug('loupedeck.clearDeck()')

		this.#loupedeck.blankDevice(true, true).catch((e) => {
			this.logger.debug(`blank failed: ${e}`)
		})
	}
}

export default SurfaceUSBLoupedeckCt
