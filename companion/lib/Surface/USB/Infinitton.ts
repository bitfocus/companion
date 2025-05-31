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

import imageRs from '@julusian/image-rs'
import Infinitton from 'infinitton-idisplay'
import { translateRotation } from '../../Resources/Util.js'
import { EventEmitter } from 'events'
import LogController, { Logger } from '../../Log/Controller.js'
import { convertPanelIndexToXY, convertXYToIndexForPanel } from '../Util.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'

const configFields: CompanionSurfaceConfigField[] = [
	...OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBInfinitton extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any>

	readonly #infinitton: Infinitton

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/ElgatoStreamdeck/${devicePath}`)

		try {
			this.config = {
				brightness: 100,
				rotation: 0,
			}

			this.#logger.debug(`Adding infinitton iDisplay USB device: ${devicePath}`)

			this.#infinitton = new Infinitton(devicePath)

			// @ts-ignore
			const serialNumber = this.#infinitton.device.getDeviceInfo().serialNumber

			this.info = {
				type: 'Infinitton iDisplay device',
				devicePath: devicePath,
				configFields: configFields,
				deviceId: `infinitton:${serialNumber}`,
			}

			this.gridSize = {
				columns: 5,
				rows: 3,
			}

			this.#infinitton.on('down', (keyIndex) => {
				const key = this.#reverseButton(keyIndex)
				if (key === undefined) return

				this.#emitClick(key, true)
			})

			this.#infinitton.on('up', (keyIndex) => {
				const key = this.#reverseButton(keyIndex)
				if (key === undefined) return

				this.#emitClick(key, false)
			})

			this.#infinitton.on('error', (error) => {
				console.error(error)
				this.emit('remove')
			})
		} catch (e) {
			// @ts-expect-error May not be defined yet
			if (this.#infinitton) {
				this.#infinitton.close()
			}

			throw e
		}
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

	#init(): void {
		this.#logger.debug(`Infinitton iDisplay detected`)

		// Make sure the first clear happens properly
		this.clearDeck()
	}

	/**
	 * Open an infinitton
	 */
	static async create(devicePath: string): Promise<SurfaceUSBInfinitton> {
		const self = new SurfaceUSBInfinitton(devicePath)

		self.#init()

		return self
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 */
	setConfig(config: Record<string, any>, force = false): void {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#infinitton.setBrightness(config.brightness)
		}

		this.config = config
	}

	quit(): void {
		const dev = this.#infinitton

		if (dev !== undefined) {
			try {
				this.clearDeck()
			} catch (e) {}

			dev.close()
		}
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		let key = convertXYToIndexForPanel(x, y, this.gridSize)
		if (key === null) return

		key = this.#mapButton(key)

		if (key >= 0 && !isNaN(key)) {
			const targetSize = 72
			const rotation = translateRotation(this.config.rotation)

			try {
				let image = imageRs.ImageTransformer.fromBuffer(
					render.buffer,
					render.bufferWidth,
					render.bufferHeight,
					imageRs.PixelFormat.Rgba
				).scale(targetSize, targetSize)

				if (rotation !== null) image = image.rotate(rotation)

				const newbuffer = image.toBufferSync(imageRs.PixelFormat.Rgb).buffer
				this.#infinitton.fillImage(key, newbuffer)
			} catch (e: any) {
				this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		}
	}

	#mapButton(input: number): number {
		const map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
		if (input < 0) {
			return -1
		}

		return parseInt(map[input])
	}

	#reverseButton(input: number): number | undefined {
		const map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
		for (let pos = 0; pos < map.length; pos++) {
			if (Number(map[input]) == pos) return pos
		}

		return
	}

	clearDeck(): void {
		this.#logger.debug('infinitton.prototype.clearDeck()')

		const keysTotal = this.gridSize.columns * this.gridSize.rows
		for (let x = 0; x < keysTotal; x++) {
			this.#infinitton.clearKey(x)
		}
	}
}
