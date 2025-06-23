/*
 * This file is part of the Companion project
 * Copyright (c) 2023 Bitfocus AS
 * Authors: Dorian Meid <dnmeid@gmx.net>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'events'
import {
	LoupedeckBufferFormat,
	LoupedeckControlInfo,
	LoupedeckControlType,
	LoupedeckDevice,
	LoupedeckDisplayId,
	openLoupedeck,
} from '@loupedeck/node'
import { convertPanelIndexToXY } from '../Util.js'
import { transformButtonImage } from '../../Resources/Util.js'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import LogController, { Logger } from '../../Log/Controller.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import { colorToRgb } from './Util.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'

interface DisplayInfo {
	lcdCols: number
	lcdRows: number
	lcdXOffset: number
	lcdYOffset: number
}

interface ModelInfo {
	totalCols: number
	totalRows: number
	displays: Record<string, DisplayInfo>
	encoders: Array<[x: number, y: number]>
	buttons: Array<[x: number, y: number]>
}

/**
 * Convert a loupedeck control to x/y coordinates
 */
function buttonToXY(modelInfo: ModelInfo, info: LoupedeckControlInfo): [x: number, y: number] | undefined {
	const index = modelInfo.buttons[info.index]
	if (info.type === LoupedeckControlType.Button && index !== undefined) {
		return index
	}

	return undefined
}
/**
 * Convert a loupedeck lcd x/y coordinate to companion x/y coordinates
 */
const translateTouchKeyIndex = (displayInfo: DisplayInfo, key: number): number => {
	const x = key % displayInfo.lcdCols
	const y = Math.floor(key / displayInfo.lcdCols)
	return y * 8 + x + displayInfo.lcdXOffset + displayInfo.lcdYOffset * 8
}

/**
 * Convert a loupedeck control to x/y coordinates
 */
function rotaryToXY(modelInfo: ModelInfo, info: LoupedeckControlInfo): [x: number, y: number] | undefined {
	const index = modelInfo.encoders[info.index]
	if (info.type === LoupedeckControlType.Rotary && index !== undefined) {
		return index
	}

	return undefined
}

const configFields: CompanionSurfaceConfigField[] = [
	...OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBLoupedeckCt extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	/**
	 * Loupdeck device handle
	 */
	readonly #loupedeck: LoupedeckDevice

	/**
	 * Information about the current loupedeck model
	 */
	readonly #modelInfo: ModelInfo

	readonly #writeQueue: ImageWriteQueue<number, [ImageResult]>

	config: Record<string, any>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, loupedeck: LoupedeckDevice, modelInfo: ModelInfo, serialNumber: string) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/Loupedeck/${devicePath}`)

		this.#loupedeck = loupedeck
		this.#modelInfo = modelInfo

		this.config = {
			brightness: 100,
		}

		this.#logger.debug(`Adding Loupedeck CT device ${devicePath}`)

		this.info = {
			type: `Loupedeck CT`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `loupedeck:${serialNumber}`,
		}

		this.gridSize = {
			columns: 8,
			rows: 7,
		}

		this.#loupedeck.on('error', (error) => {
			this.#logger.error(`error: ${error}`)
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
		this.#loupedeck.on('touchmove', (data) => {
			const touch = data.changedTouches.find(
				(touch) => touch.target.screen == LoupedeckDisplayId.Right || touch.target.screen == LoupedeckDisplayId.Left
			)
			if (touch && touch.target.screen == LoupedeckDisplayId.Right) {
				const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
				this.emit('setVariable', 't-bar', val)
				this.#loupedeck
					.drawSolidColour(LoupedeckDisplayId.Right, { red: 0, green: 0, blue: 0 }, 60, val + 7, 0, 0)
					.catch((e) => {
						this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
					})
				this.#loupedeck
					.drawSolidColour(LoupedeckDisplayId.Right, { red: 0, green: 127, blue: 0 }, 60, 262 - val, 0, val + 7)
					.catch((e) => {
						this.#logger.error('Drawing right fader value ' + touch.y + ' to loupedeck failed: ' + e)
					})
			} else if (touch && touch.target.screen == LoupedeckDisplayId.Left) {
				const val = Math.min(touch.y + 7, 256) // map the touch screen height of 270 to 256 by capping top and bottom 7 pixels
				this.emit('setVariable', 'shuttle', val)
				this.#loupedeck
					.drawSolidColour(LoupedeckDisplayId.Left, { red: 0, green: 0, blue: 0 }, 60, val + 7, 0, 0)
					.catch((e) => {
						this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
					})
				this.#loupedeck
					.drawSolidColour(LoupedeckDisplayId.Left, { red: 127, green: 0, blue: 0 }, 60, 262 - val, 0, val + 7)
					.catch((e) => {
						this.#logger.error('Drawing left fader value ' + touch.y + ' to loupedeck failed: ' + e)
					})
			}
		})

		// this.#loupedeck.on('disconnect', (error) => {
		// 	this.#logger.error(`disconnected: ${error}`)
		// 	this.emit('remove')
		// })

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (key, render) => {
			let width = this.#loupedeck.lcdKeySize
			let height = this.#loupedeck.lcdKeySize

			if (key === 35) {
				width = 240
				height = 240
			}

			// const rotation = translateRotation(this.config.rotation)

			let newbuffer: Buffer
			try {
				newbuffer = await transformButtonImage(render, this.config.rotation, width, height, imageRs.PixelFormat.Rgb)
			} catch (e) {
				this.#logger.debug(`scale image failed: ${e}`)
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
				this.#logger.debug(`fillImage failed after: ${e}`)
				this.emit('remove')
			}
		})
	}
	/**
	 * Produce a click event
	 */
	#emitClick(xy: [x: number, y: number] | null | undefined, state: boolean) {
		if (!xy) return

		const x = xy[0]
		const y = xy[1]

		this.emit('click', x, y, state)
	}

	/**
	 * Open a loupedeck CT
	 */
	static async create(devicePath: string): Promise<SurfaceUSBLoupedeckCt> {
		const loupedeck = await openLoupedeck(devicePath)
		try {
			const info: ModelInfo = {
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

			self.clearDeck()

			return self
		} catch (e) {
			await loupedeck.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 */
	setConfig(config: Record<string, any>, force = false): void {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#loupedeck.setBrightness(config.brightness / 100).catch((e) => {
				this.#logger.debug(`Set brightness failed: ${e}`)
			})
		}

		this.config = config
	}

	quit(): void {
		this.clearDeck()

		this.#loupedeck.close().catch(() => {
			// Ignore
		})
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		const screen = this.#modelInfo.displays.center
		const lcdX = x - screen.lcdXOffset

		if (x === 3 && y === 4) {
			this.#writeQueue.queue(35, render)
		} else if (lcdX >= 0 && lcdX < screen.lcdCols && y >= 0 && y < screen.lcdRows) {
			const button = lcdX + y * screen.lcdCols
			this.#writeQueue.queue(button, render)
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
					this.#logger.debug(`color failed: ${e}`)
				})
		}
	}

	clearDeck(): void {
		this.#loupedeck.blankDevice(true, true).catch((e) => {
			this.#logger.debug(`blank failed: ${e}`)
		})
	}
}
