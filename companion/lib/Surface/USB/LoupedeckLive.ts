/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
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
	LoupedeckDevice,
	LoupedeckModelId,
	openLoupedeck,
} from '@loupedeck/node'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import LogController, { Logger } from '../../Log/Controller.js'
import { convertPanelIndexToXY } from '../Util.js'
import { transformButtonImage } from '../../Resources/Util.js'
import { colorToRgb } from './Util.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import { ImageResult } from '../../Graphics/ImageResult.js'

interface ModelInfo {
	totalCols: number
	totalRows: number
	lcdCols: number
	lcdRows: number
	lcdXOffset: number
	lcdAsButtons: boolean
	encoders: Array<[x: number, y: number]>
	buttons: Array<[x: number, y: number]>
}

const loupedeckLiveInfo: ModelInfo = {
	totalCols: 8,
	totalRows: 4,

	lcdCols: 4,
	lcdRows: 3,
	lcdXOffset: 2,
	lcdAsButtons: false,

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
const loupedeckLiveSInfo: ModelInfo = {
	totalCols: 7,
	totalRows: 3,

	lcdCols: 5,
	lcdRows: 3,
	lcdXOffset: 1,
	lcdAsButtons: false,

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
const razerStreamControllerXInfo: ModelInfo = {
	totalCols: 5,
	totalRows: 3,

	lcdCols: 5,
	lcdRows: 3,
	lcdXOffset: 0,
	lcdAsButtons: true,

	encoders: [],
	buttons: [],
}

/**
 * Convert a loupedeck control to x/y coordinates
 */
function buttonToXY(modelInfo: ModelInfo, info: LoupedeckControlInfo): [x: number, y: number] | undefined {
	const index = modelInfo.buttons[info.index]
	if (info.type === 'button' && index !== undefined) {
		return index
	}

	return undefined
}
/**
 * Convert a loupedeck lcd x/y coordinate to companion x/y coordinates
 */
const translateTouchKeyIndex = (modelInfo: ModelInfo, key: number): number => {
	const x = key % modelInfo.lcdCols
	const y = Math.floor(key / modelInfo.lcdCols)
	return y * modelInfo.totalCols + x + modelInfo.lcdXOffset
}

/**
 * Convert a loupedeck control to x/y coordinates
 */
function rotaryToXY(modelInfo: ModelInfo, info: LoupedeckControlInfo): [x: number, y: number] | undefined {
	const index = modelInfo.encoders[info.index]
	if (info.type === 'rotary' && index !== undefined) {
		return index
	}

	return undefined
}

const configFields: CompanionSurfaceConfigField[] = [
	//
	...OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBLoupedeckLive extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	/**
	 * Loupdeck device handle
	 */
	readonly #loupedeck: LoupedeckDevice

	/**
	 * Information about the current loupedeck model
	 */
	readonly #modelInfo: ModelInfo

	readonly #writeQueue: ImageWriteQueue<number, [import('../../Graphics/ImageResult.js').ImageResult]>

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

		this.#logger.debug(`Adding Loupedeck Live USB device ${devicePath}`)

		this.info = {
			type: this.#loupedeck.modelName,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `loupedeck:${serialNumber}`,
		}

		this.gridSize = {
			columns: this.#modelInfo.totalCols,
			rows: this.#modelInfo.totalRows,
		}

		this.#loupedeck.on('error', (error) => {
			this.#logger.error(`error: ${error}`)
			this.emit('remove')
		})

		this.#loupedeck.on('down', (info) => {
			if (this.#modelInfo.lcdAsButtons) {
				this.#emitClick(info.index, true)
			} else {
				const xy = buttonToXY(this.#modelInfo, info) ?? rotaryToXY(this.#modelInfo, info)
				if (!xy) {
					return
				}

				this.emit('click', ...xy, true)
			}
		})

		this.#loupedeck.on('up', (info) => {
			if (this.#modelInfo.lcdAsButtons) {
				this.#emitClick(info.index, false)
			} else {
				const xy = buttonToXY(this.#modelInfo, info) ?? rotaryToXY(this.#modelInfo, info)
				if (!xy) {
					return
				}

				this.emit('click', ...xy, false)
			}
		})
		this.#loupedeck.on('rotate', (info, delta) => {
			const xy = rotaryToXY(this.#modelInfo, info)
			if (!xy) {
				return
			}

			this.emit('rotate', ...xy, delta == 1)
		})
		this.#loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.#modelInfo, touch.target.key)
					this.#emitClick(keyIndex, true)
				}
			}
		})
		this.#loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				if (touch.target.key !== undefined) {
					const keyIndex = translateTouchKeyIndex(this.#modelInfo, touch.target.key)
					this.#emitClick(keyIndex, false)
				}
			}
		})

		// @ts-ignore
		this.#loupedeck.on('disconnect', (error) => {
			this.#logger.error(`disconnected: ${error}`)
			this.emit('remove')
		})

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (key, render) => {
			const width = this.#loupedeck.lcdKeySize
			const height = this.#loupedeck.lcdKeySize

			let newbuffer
			try {
				newbuffer = await transformButtonImage(render, this.config.rotation, width, height, imageRs.PixelFormat.Rgb)
			} catch (e) {
				this.#logger.debug(`scale image failed: ${e}`)
				this.emit('remove')
				return
			}

			try {
				await this.#loupedeck.drawKeyBuffer(key, newbuffer, LoupedeckBufferFormat.RGB)
			} catch (e) {
				this.#logger.debug(`fillImage failed: ${e}`)
				this.emit('remove')
			}
		})
	}

	/**
	 * Produce a click event
	 */
	#emitClick(key: number, state: boolean) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	/**
	 * Open a loupedeck
	 */
	static async create(devicePath: string): Promise<SurfaceUSBLoupedeckLive> {
		const loupedeck = await openLoupedeck(devicePath)
		try {
			let info = null
			switch (loupedeck.modelId) {
				case LoupedeckModelId.LoupedeckLive:
				case LoupedeckModelId.RazerStreamController:
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

			const self = new SurfaceUSBLoupedeckLive(devicePath, loupedeck, info, serialNumber)

			self.clearDeck()

			return self
		} catch (e) {
			loupedeck.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
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
		try {
			this.clearDeck()
		} catch (e) {}

		this.#loupedeck.close()
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		const lcdX = x - this.#modelInfo.lcdXOffset
		if (lcdX >= 0 && lcdX < this.#modelInfo.lcdCols && y >= 0 && y < this.#modelInfo.lcdRows) {
			const button = lcdX + y * this.#modelInfo.lcdCols

			this.#writeQueue.queue(button, render)
		}

		const buttonIndex = this.#modelInfo.buttons.findIndex((btn) => btn[0] == x && btn[1] == y)
		if (buttonIndex >= 0) {
			const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }

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
		this.#logger.debug('loupedeck.clearDeck()')

		this.#loupedeck.blankDevice(true, true).catch((e) => {
			this.#logger.debug(`blank failed: ${e}`)
		})
	}
}
