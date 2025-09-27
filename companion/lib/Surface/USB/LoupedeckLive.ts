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
import { LoupedeckBufferFormat, LoupedeckDevice, openLoupedeck } from '@loupedeck/node'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import LogController, { Logger } from '../../Log/Controller.js'
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

	readonly #writeQueue: ImageWriteQueue<string, [ImageResult]>

	config: Record<string, any>

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, loupedeck: LoupedeckDevice, serialNumber: string) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/Loupedeck/${devicePath}`)

		this.#loupedeck = loupedeck

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

		const allRowValues = this.#loupedeck.controls.map((control) => control.row)
		const allColumnValues = this.#loupedeck.controls.map((button) => button.column)

		this.gridSize = {
			columns: Math.max(...allColumnValues) + 1,
			rows: Math.max(...allRowValues) + 1,
		}

		this.#loupedeck.on('error', (error) => {
			this.#logger.error(`error: ${error}`)
			this.emit('remove')
		})

		this.#loupedeck.on('down', (info) => {
			this.emit('click', info.column, info.row, true)
		})

		this.#loupedeck.on('up', (info) => {
			this.emit('click', info.column, info.row, false)
		})
		this.#loupedeck.on('rotate', (info, delta) => {
			if (info.type === 'wheel') return // TODO - handle

			this.emit('rotate', info.column, info.row, delta == 1)
		})
		this.#loupedeck.on('touchstart', (data) => {
			for (const touch of data.changedTouches) {
				const control = touch.target.control
				if (control !== undefined) {
					this.emit('click', control.column, control.row, true)
				}
			}
		})
		this.#loupedeck.on('touchend', (data) => {
			for (const touch of data.changedTouches) {
				const control = touch.target.control
				if (control !== undefined) {
					this.emit('click', control.column, control.row, false)
				}
			}
		})

		// this.#loupedeck.on('disconnect', (error) => {
		// 	this.#logger.error(`disconnected: ${error}`)
		// 	this.emit('remove')
		// })

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (buttonId, render) => {
			const width = this.#loupedeck.lcdKeySize
			const height = this.#loupedeck.lcdKeySize

			let newbuffer
			try {
				newbuffer = await transformButtonImage(render, this.config.rotation, width, height, 'rgb')
			} catch (e) {
				this.#logger.debug(`scale image failed: ${e}`)
				this.emit('remove')
				return
			}

			try {
				await this.#loupedeck.drawKeyBuffer(buttonId, newbuffer, LoupedeckBufferFormat.RGB)
			} catch (e) {
				this.#logger.debug(`fillImage failed: ${e}`)
				this.emit('remove')
			}
		})
	}

	/**
	 * Open a loupedeck
	 */
	static async create(devicePath: string): Promise<SurfaceUSBLoupedeckLive> {
		const loupedeck = await openLoupedeck(devicePath)
		try {
			const serialNumber = await loupedeck.getSerialNumber()

			const self = new SurfaceUSBLoupedeckLive(devicePath, loupedeck, serialNumber)

			self.clearDeck()

			return self
		} catch (e) {
			await loupedeck.close()

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
		this.clearDeck()

		this.#loupedeck.close().catch(() => {
			// Ignore
		})
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		const control = this.#loupedeck.controls.find((c) => c.row === y && c.column === x)
		if (!control) return

		if (control.type === 'wheel') {
			// TODO
		} else if (control.type === 'encoder') {
			// Nothing to do
		} else if (control.type === 'button') {
			if (control.feedbackType === 'rgb') {
				const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }

				this.#loupedeck
					.setButtonColor({
						id: control.id,
						red: color.r,
						green: color.g,
						blue: color.b,
					})
					.catch((e) => {
						this.#logger.debug(`color failed: ${e}`)
					})
			} else if (control.feedbackType === 'lcd') {
				this.#writeQueue.queue(control.id, render)
			}
		}
	}

	clearDeck(): void {
		this.#logger.debug('loupedeck.clearDeck()')

		this.#loupedeck.blankDevice(true, true).catch((e) => {
			this.#logger.debug(`blank failed: ${e}`)
		})
	}
}
