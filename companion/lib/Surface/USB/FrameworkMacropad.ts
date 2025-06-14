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
import LogController, { Logger } from '../../Log/Controller.js'
import { HIDAsync } from 'node-hid'
import { colorToRgb, RgbColor } from './Util.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { DrawButtonItem, SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'

const configFields: CompanionSurfaceConfigField[] = [
	//
	...OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	...LockConfigFields,
]

/**
 * This is an implementation of a simple HID device for the framework macropad.
 * It is unlikely that this module will get much use, it is more of a toy than useful for production.
 * Hardware: https://frame.work/gb/en/products/16-rgb-macropad
 * It uses a custom firmware available from https://github.com/Julusian/framework_qmk_firmware
 */
export class SurfaceUSBFrameworkMacropad extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any> = {}

	/**
	 * HID device
	 */
	readonly #device: HIDAsync

	/**
	 * Last drawn colours, to allow resending when brightness changes
	 */
	readonly #lastColours: Record<string, RgbColor> = {}

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, device: HIDAsync) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/FrameworkMacropad/${devicePath}`)

		this.config = {
			brightness: 50,
		}

		this.#logger.debug(`Adding framework-macropad USB device: ${devicePath}`)

		this.#device = device

		this.info = {
			type: `Framework Macropad`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `framework-macropad`,
		}

		this.gridSize = {
			columns: 4,
			rows: 6,
		}

		this.#device.on('error', (error) => {
			this.#logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.#device.on('data', (data) => {
			if (data[0] === 0x50) {
				const x = data[1] - 1
				const y = data[2] - 1
				const pressed = data[3] > 0

				this.emit('click', x, y, pressed)
			}
		})
	}

	/**
	 * Open a framework macropad
	 */
	static async create(devicePath: string): Promise<SurfaceUSBFrameworkMacropad> {
		const device = await HIDAsync.open(devicePath)

		try {
			const self = new SurfaceUSBFrameworkMacropad(devicePath, device)

			// Make sure the first clear happens properly
			self.clearDeck()

			return self
		} catch (e) {
			await device.close().catch(() => null)

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, force = false) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			for (let y = 0; y < this.gridSize.rows; y++) {
				for (let x = 0; x < this.gridSize.columns; x++) {
					const color = this.#lastColours[`${x},${y}`] ?? { r: 0, g: 0, b: 0 }
					this.#writeKeyColour(x, y, color)
				}
			}
		}

		this.config = config
	}

	quit(): void {
		this.#clearPanel()
			.catch((e) => {
				this.#logger.debug(`Clear deck failed: ${e}`)
			})
			.then(() => {
				//close after the clear has been sent
				this.#device.close()
			})
	}

	clearDeck(): void {
		this.#clearPanel().catch((e) => {
			this.#logger.debug(`Clear deck failed: ${e}`)
		})
	}

	async #clearPanel(): Promise<void> {
		const clearBuffer = Buffer.alloc(32)
		clearBuffer.writeUint8(0x0b, 0)
		await this.#device.write(clearBuffer)
	}

	/**
	 * Draw a button
	 */
	draw(item: DrawButtonItem): void {
		const color = colorToRgb(item.defaultRender.bgcolor)
		this.#lastColours[`${item.x},${item.y}`] = color
		this.#writeKeyColour(item.x, item.y, color)
	}

	#writeKeyColour(x: number, y: number, color: RgbColor): void {
		const fillBuffer = Buffer.alloc(32)
		fillBuffer.writeUint8(0x0f, 0)
		fillBuffer.writeUint8(x + 1, 1)
		fillBuffer.writeUint8(y + 1, 2)

		const scale = (this.config.brightness || 50) / 100
		fillBuffer.writeUint8(color.r * scale, 3)
		fillBuffer.writeUint8(color.g * scale, 4)
		fillBuffer.writeUint8(color.b * scale, 5)

		this.#device.write(fillBuffer).catch((e) => {
			this.#logger.error(`write failed: ${e}`)
		})
	}
}
