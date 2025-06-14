/*
 * This file is part of the Companion project
 * Copyright (c) 2022 VICREO BV
 * Author: Jeffrey Davidsz <jeffrey.davidsz@vicreo.eu>
 *
 * This program is free software.
 * You should have received a copy of the MIT license as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'events'
import { XKeys, setupXkeysPanel, Color as XKeysColor } from 'xkeys'
import LogController, { Logger } from '../../Log/Controller.js'
import {
	OffsetConfigFields,
	BrightnessConfigField,
	RotationConfigField,
	LockConfigFields,
} from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type {
	DrawButtonItem,
	LocalUSBDeviceOptions,
	SurfacePanel,
	SurfacePanelEvents,
	SurfacePanelInfo,
} from '../Types.js'

const configFields: CompanionSurfaceConfigField[] = [
	...OffsetConfigFields,
	BrightnessConfigField,
	{
		id: 'illuminate_pressed',
		type: 'checkbox',
		label: 'Illuminate pressed buttons',
		default: true,
	},
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBXKeys extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	config: Record<string, any> = {}

	/**
	 * Last drawn colors to the device
	 */
	readonly #lastColors: Array<XKeysColor | undefined> = []

	/**
	 * Current pressed button indices
	 */
	readonly #pressed = new Set<number>()

	/**
	 * Xkeys panel
	 */
	readonly #myXkeysPanel: XKeys

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(devicePath: string, panel: XKeys, deviceId: string, _options: LocalUSBDeviceOptions) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/XKeys/${devicePath}`)

		this.#logger.debug(`Adding xkeys ${panel.info.name} USB device: ${devicePath}`)

		this.#myXkeysPanel = panel

		this.info = {
			type: `XKeys ${this.#myXkeysPanel.info.name}`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: deviceId,
		}

		this.config = {
			brightness: 60,
			illuminate_pressed: true,
		}

		const { colCount, rowCount } = this.#myXkeysPanel.info

		this.gridSize = {
			columns: colCount,
			rows: rowCount,
		}

		// Blank out every key
		for (let keyIndex = 1; keyIndex <= colCount * rowCount; keyIndex++) {
			this.#myXkeysPanel.setBacklight(keyIndex, false)
		}

		this.#myXkeysPanel.on('disconnected', () => {
			this.#logger.silly(`X-keys panel of type ${this.#myXkeysPanel.info.name} was disconnected`)
			// Clean up stuff
			this.#myXkeysPanel.removeAllListeners()
			this.emit('remove')
		})

		this.#myXkeysPanel.on('error', (...errs) => {
			this.#logger.error('X-keys error:', ...errs)
			this.emit('remove')
		})

		// Listen to pressed buttons:
		this.#myXkeysPanel.on('down', (keyIndex) => {
			const location = this.#translateIndexToXY(keyIndex)
			if (!location) return

			const [x, y] = location

			this.#logger.debug(`keyIndex: ${keyIndex}, companion button: ${y}/${x}`)
			this.#pressed.add(keyIndex)

			this.emit('click', x, y, true)

			// Light up a button when pressed:
			try {
				this.#myXkeysPanel.setIndicatorLED(1, true)
				if (this.config.illuminate_pressed) {
					this.#myXkeysPanel.setBacklight(keyIndex, 'red')
				}
			} catch (e) {
				this.#logger.debug(`Failed to set indicator: ${e}`)
			}
		})

		// Listen to released buttons:
		this.#myXkeysPanel.on('up', (keyIndex) => {
			const location = this.#translateIndexToXY(keyIndex)
			if (!location) return

			const [x, y] = location

			this.#logger.debug(`keyIndex: ${keyIndex}, companion button: ${y}/${x}`)
			this.#pressed.delete(keyIndex)

			this.emit('click', x, y, false)

			// Turn off button light when released:
			try {
				this.#myXkeysPanel.setIndicatorLED(1, false)
				if (this.config.illuminate_pressed) {
					this.#myXkeysPanel.setBacklight(keyIndex, this.#lastColors[keyIndex] || false)
				}
			} catch (e) {
				this.#logger.debug(`Failed to set indicator: ${e}`)
			}
		})

		// Listen to jog wheel changes:
		this.#myXkeysPanel.on('jog', (index, deltaPos, metadata) => {
			this.#logger.silly(`Jog ${index} position has changed`, deltaPos, metadata)
			this.emit('setVariable', 'jog', deltaPos)
			setTimeout(() => {
				this.emit('setVariable', 'jog', 0)
			}, 20)
		})
		// Listen to shuttle changes:
		this.#myXkeysPanel.on('shuttle', (index, shuttlePos, metadata) => {
			this.#logger.silly(`Shuttle ${index} position has changed`, shuttlePos, metadata)
			this.emit('setVariable', 'shuttle', shuttlePos)
		})
		// Listen to joystick changes:
		this.#myXkeysPanel.on('joystick', (index, position, metadata) => {
			this.#logger.silly(`Joystick ${index} position has changed`, position, metadata) // {x, y, z}
			//TODO
			// this.emit('setVariable', 'joystick', position)
		})
		// Listen to t-bar changes:
		this.#myXkeysPanel.on('tbar', (index, position, metadata) => {
			this.#logger.silly(`T-bar ${index} position has changed`, position, metadata)
			this.emit('setVariable', 't-bar', position)
		})
	}

	/**
	 * Translate companion keyindex to xkeys
	 */
	#translateIndexToXY(keyIndex: number): [x: number, y: number] | void {
		const gridSize = this.gridSize
		keyIndex -= 1
		if (isNaN(keyIndex) || keyIndex < 0 || keyIndex >= gridSize.columns * gridSize.rows) return undefined
		const x = Math.floor(keyIndex / gridSize.rows)
		const y = keyIndex % gridSize.rows
		return [x, y]
	}

	/**
	 * Create an xkeys device
	 */
	static async create(devicePath: string, options: LocalUSBDeviceOptions): Promise<SurfaceUSBXKeys> {
		const panel = await setupXkeysPanel(devicePath)

		try {
			const deviceId = `xkeys:${panel.info.productId}-${panel.info.unitId}` // TODO - this needs some additional uniqueness to the suffix
			// (${devicePath.slice(0, -1).slice(-10)})` // This suffix produces `dev/hidraw` on linux, which is not useful.

			const self = new SurfaceUSBXKeys(devicePath, panel, deviceId, options || {})

			return self
		} catch (e) {
			panel.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 */
	setConfig(config: Record<string, any>): void {
		try {
			if (
				(this.config.brightness != config.brightness && config.brightness !== undefined) ||
				this.config.illuminate_pressed !== config.illuminate_pressed
			) {
				const intensity = config.brightness * 2.55
				this.#myXkeysPanel.setBacklightIntensity(intensity, config.illuminate_pressed ? 255 : intensity)
			} else if (config.brightness === undefined) {
				this.#myXkeysPanel.setBacklightIntensity(60, config.illuminate_pressed ? 255 : 60)
			}
		} catch (e) {
			this.#logger.debug(`Failed to set backlight: ${e}`)
		}

		this.config = config
	}

	/**
	 * When quit is called, close the deck
	 */
	quit(): void {
		const xkeys = this.#myXkeysPanel

		if (xkeys) {
			try {
				xkeys.close()
			} catch (e) {}
		}
	}

	/**
	 * Draw a button
	 */
	draw(item: DrawButtonItem): void {
		const gridSize = this.gridSize
		if (item.x < 0 || item.y < 0 || item.x >= gridSize.columns || item.y >= gridSize.rows) return

		const buttonIndex = item.x * gridSize.rows + item.y + 1
		const color = item.style?.bgcolor ?? 0
		this.#drawColorAtIndex(buttonIndex, color)
	}

	/**
	 * Set the color of a button by device index
	 * @param buttonIndex
	 * @param color 24bit colour value
	 */
	#drawColorAtIndex(buttonIndex: number | undefined, color: number): void {
		if (buttonIndex === undefined) return

		// Feedback
		const rawColor = {
			r: (color >> 16) & 0xff,
			g: (color >> 8) & 0xff,
			b: color & 0xff,
		}

		const tmpColor = { ...rawColor }
		if (this.#pressed.has(buttonIndex) && this.config.illuminate_pressed) tmpColor.r = 255

		try {
			this.#myXkeysPanel.setBacklight(buttonIndex, tmpColor)
		} catch (e) {
			this.#logger.debug(`Failed to set backlight: ${e}`)
		}

		this.#lastColors[buttonIndex] = rawColor
	}

	clearDeck(): void {
		// noop
	}
}
