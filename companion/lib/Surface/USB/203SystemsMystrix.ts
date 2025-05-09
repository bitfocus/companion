/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>, Nengzhuo Cai <Null@203.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'events'
import LogController, { Logger } from '../../Log/Controller.js'
import { colorToRgb, RgbColor } from './Util.js'
import HID from 'node-hid'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import type { GridSize } from '@companion-app/shared/Model/Surfaces.js'

/**
 * This is an implementation of a simple MIDI device for the 203 Systems Mystrix control surface.
 * Hardware: https://203.io/
 * It uses a specific OS available from https://github.com/203Electronics/MatrixOS
 * This driver targets the Matrix OS's Companion APP,
 */
export class SurfaceUSB203SystemsMystrix extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any> = {}

	readonly #device: HID.HID

	/**
	 * Last drawn colours, to allow resending when app launched or other off sync situations
	 */
	#lastColours: RgbColor[][] = []

	/**
	 * Device is active or not
	 */
	#deviceActive: boolean = false

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, device: HID.HID) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/203SystemsMystrix/${devicePath}`)

		this.config = {
			brightness: 100,
		}

		this.#logger.debug(`Adding 203 Systems Mystrix USB device: ${devicePath}`)

		this.#device = device

		this.info = {
			type: `203 Systems Mystrix`,
			devicePath: devicePath,
			configFields: [],
			deviceId: `203-mystrix`,
		}

		this.gridSize = {
			columns: 8,
			rows: 8,
		}

		this.#device.on('error', (error) => {
			this.#logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.#inquiryActive()
		this.#clearPanel()

		this.#device.on('data', (data) => {
			if (data[0] === 0xff && data[1] === 0x01) {
				if (data[2] == 1) {
					this.#deviceActive = true
					this.#refreshPanel()
				} else {
					this.#deviceActive = false
				}
			} else if (data[0] === 0xff && data[1] === 0x10) {
				const x = data[2]
				const y = data[3]
				const pressed = data[4] > 0

				this.emit('click', x, y, pressed)
			}
		})
	}

	/**
	 * Open a 203 Systems Mystrix
	 */
	static async create(devicePath: string): Promise<SurfaceUSB203SystemsMystrix> {
		const device = new HID.HID(devicePath)

		try {
			const self = new SurfaceUSB203SystemsMystrix(devicePath, device)

			// Make sure the first clear happens properly & set up the lastColours array
			self.clearDeck()

			return self
		} catch (e) {
			device.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 */
	setConfig(config: Record<string, any>, force = false): void {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#updateBrightness(config.brightness)
		}

		this.config = config
	}

	quit(): void {
		this.clearDeck
	}

	clearDeck(): void {
		this.#clearPanel()
	}

	#clearPanel(): void {
		this.#lastColours = Array.from({ length: this.gridSize.columns }, () =>
			Array.from({ length: this.gridSize.rows }, () => ({ r: 0, g: 0, b: 0 }))
		)

		if (!this.#deviceActive) {
			return
		}

		this.#device.write([0xff, 0x21])
	}

	#refreshPanel(): void {
		// Clear the panel first
		this.#device.write([0xff, 0x21])

		for (let y = 0; y < this.gridSize.rows; y++) {
			for (let x = 0; x < this.gridSize.columns; x++) {
				const color = this.#lastColours[x][y]
				if (color.r == 0 && color.g == 0 && color.b == 0) {
					continue
				}
				this.#writeKeyColour(x, y, color, true)
			}
		}
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }

		this.#writeKeyColour(x, y, color)
	}

	#writeKeyColour(x: number, y: number, color: RgbColor, forced = false): void {
		if (!this.#deviceActive) {
			return
		}

		var lastColor = this.#lastColours[x][y]

		if (!forced && color.r == lastColor.r && color.g == lastColor.g && color.b == lastColor.b) {
			return
		}

		this.#lastColours[x][y] = color

		this.#device.write([0xff, 0x20, x, y, color.r, color.g, color.b])
	}

	#updateBrightness(brightness: number): void {
		this.#device.write([0xff, 0x30, brightness])
	}

	#inquiryActive(): void {
		this.#device.write([0xff, 0x01])
	}
}
