// @ts-check

/*
 * This file is part of the Companion project
 * Copyright (c) 2022 VICREO BV
 * Author: Jeffrey Davidsz <jeffrey.davidsz@vicreo.eu>
 *
 * This program is free software.
 * You should have received a copy of the MIT license as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */

import { EventEmitter } from 'events'
import { setupXkeysPanel } from 'xkeys'
import LogController from '../../Log/Controller.js'
import { convertPanelIndexToXY, convertXYToIndexForPanel } from '../Util.js'
import { LEGACY_BUTTONS_PER_COLUMN, LEGACY_BUTTONS_PER_ROW, LEGACY_MAX_BUTTONS } from '../../Util/Constants.js'

/**
 * Creates an instance of xkeys.
 * @param {*} system
 * @param {*} devicePath
 * @memberof xkeys
 */
class SurfaceUSBXKeys extends EventEmitter {
	constructor(devicePath, panel, deviceId, options) {
		super()

		this.logger = LogController.createLogger(`Surface/USB/XKeys/${devicePath}`)

		this.myXkeysPanel = panel
		this.useLegacyLayout = !!options.useLegacyLayout
		this.mapDeviceToCompanion = []
		this.mapCompanionToDevice = []

		this.lastColors = []
		this.pressed = new Set()

		this.info = {
			type: `XKeys ${this.myXkeysPanel.info.name}`,
			devicePath: devicePath,
			configFields: ['brightness', 'illuminate_pressed'],
			deviceId: deviceId,
		}

		this.config = {
			brightness: 60,
			illuminate_pressed: true,
		}

		const { colCount, rowCount } = this.myXkeysPanel.info

		if (this.useLegacyLayout) {
			this.gridSize = {
				columns: LEGACY_BUTTONS_PER_ROW,
				rows: LEGACY_BUTTONS_PER_COLUMN,
			}

			// Mapping buttons
			for (var leftRight = 0; leftRight < colCount; leftRight++) {
				for (var topBottom = 0; topBottom < rowCount; topBottom++) {
					this.mapDeviceToCompanion.push(leftRight + topBottom * colCount)
				}
			}
			// Mapping for feedback
			for (let topBottom = 1; topBottom <= rowCount; topBottom++) {
				for (let leftRight = 0; leftRight < colCount; leftRight++) {
					this.mapCompanionToDevice.push(topBottom + leftRight * rowCount)
				}
			}
		} else {
			this.gridSize = {
				columns: colCount,
				rows: rowCount,
			}
		}

		// Blank out every key
		for (let keyIndex = 1; keyIndex <= colCount * rowCount; keyIndex++) {
			this.myXkeysPanel.setBacklight(keyIndex, false)
		}

		this.myXkeysPanel.on('disconnected', () => {
			this.logger.silly(`X-keys panel of type ${this.myXkeysPanel.info.name} was disconnected`)
			// Clean up stuff
			this.myXkeysPanel.removeAllListeners()
			this.emit('remove')
		})

		this.myXkeysPanel.on('error', (...errs) => {
			this.logger.error('X-keys error:', ...errs)
			this.emit('remove')
		})

		// Listen to pressed buttons:
		this.myXkeysPanel.on('down', (keyIndex, metadata) => {
			const location = this.#translateIndexToXY(keyIndex)
			if (!location) return

			const [x, y, pageOffset] = location

			this.logger.debug(`keyIndex: ${keyIndex}, companion button: ${y}/${x}`)
			this.pressed.add(keyIndex)

			this.emit('click', x, y, true, pageOffset)

			// Light up a button when pressed:
			try {
				this.myXkeysPanel.setIndicatorLED(1, true)
				if (this.config.illuminate_pressed) {
					this.myXkeysPanel.setBacklight(keyIndex, 'red')
				}
			} catch (e) {
				this.logger.debug(`Failed to set indicator: ${e}`)
			}
		})

		// Listen to released buttons:
		this.myXkeysPanel.on('up', (keyIndex, metadata) => {
			const location = this.#translateIndexToXY(keyIndex)
			if (!location) return

			const [x, y, pageOffset] = location

			this.logger.debug(`keyIndex: ${keyIndex}, companion button: ${y}/${x}`)
			this.pressed.delete(keyIndex)

			this.emit('click', x, y, false, pageOffset)

			// Turn off button light when released:
			try {
				this.myXkeysPanel.setIndicatorLED(1, false)
				if (this.config.illuminate_pressed) {
					this.myXkeysPanel.setBacklight(keyIndex, this.lastColors[keyIndex] || false)
				}
			} catch (e) {
				this.logger.debug(`Failed to set indicator: ${e}`)
			}
		})

		// Listen to jog wheel changes:
		this.myXkeysPanel.on('jog', (index, deltaPos, metadata) => {
			this.logger.silly(`Jog ${index} position has changed`, deltaPos, metadata)
			this.emit('setVariable', 'jog', deltaPos)
			setTimeout(() => {
				this.emit('setVariable', 'jog', 0)
			}, 20)
		})
		// Listen to shuttle changes:
		this.myXkeysPanel.on('shuttle', (index, shuttlePos, metadata) => {
			this.logger.silly(`Shuttle ${index} position has changed`, shuttlePos, metadata)
			this.emit('setVariable', 'shuttle', shuttlePos)
		})
		// Listen to joystick changes:
		this.myXkeysPanel.on('joystick', (index, position, metadata) => {
			this.logger.silly(`Joystick ${index} position has changed`, position, metadata) // {x, y, z}
			//TODO
			// this.emit('setVariable', 'joystick', position)
		})
		// Listen to t-bar changes:
		this.myXkeysPanel.on('tbar', (index, position, metadata) => {
			this.logger.silly(`T-bar ${index} position has changed`, position, metadata)
			this.emit('setVariable', 't-bar', position)
		})
	}

	#translateIndexToXY(keyIndex) {
		if (this.useLegacyLayout) {
			const key = this.mapDeviceToCompanion[keyIndex - 1]
			if (key === undefined) {
				return
			}

			const pageOffset = Math.floor(key / LEGACY_MAX_BUTTONS)
			const localKey = key % LEGACY_MAX_BUTTONS

			const xy = convertPanelIndexToXY(localKey, this.gridSize)
			if (xy) {
				return [...xy, pageOffset]
			}
		} else {
			const gridSize = this.gridSize
			keyIndex -= 1
			if (isNaN(keyIndex) || keyIndex < 0 || keyIndex >= gridSize.columns * gridSize.rows) return undefined
			const x = Math.floor(keyIndex / gridSize.rows)
			const y = keyIndex % gridSize.rows
			return [x, y, undefined]
		}
	}

	async #init() {
		this.logger.debug(`Xkeys ${this.myXkeysPanel.info.name} detected`)

		if (this.useLegacyLayout) {
			setTimeout(() => {
				const { colCount, rowCount } = this.myXkeysPanel.info
				// Ask companion to provide colours for enough pages of buttons
				this.emit('xkeys-subscribePage', Math.ceil((colCount * rowCount) / LEGACY_MAX_BUTTONS))
			}, 1000)
		}
	}

	static async create(devicePath, options) {
		const panel = await setupXkeysPanel(devicePath)

		try {
			const deviceId = `xkeys:${panel.info.productId}-${panel.info.unitId}` // TODO - this needs some additional uniqueness to the sufix
			// (${devicePath.slice(0, -1).slice(-10)})` // This suffix produces `dev/hidraw` on linux, which is not useful.

			const self = new SurfaceUSBXKeys(devicePath, panel, deviceId, options || {})

			await self.#init()

			return self
		} catch (e) {
			panel.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {object} config
	 * @returns false when nothing happens
	 */
	setConfig(config) {
		try {
			if (
				(this.config.brightness != config.brightness && config.brightness !== undefined) ||
				this.config.illuminate_pressed !== config.illuminate_pressed
			) {
				const intensity = config.brightness * 2.55
				this.myXkeysPanel.setBacklightIntensity(intensity, config.illuminate_pressed ? 255 : intensity)
			} else if (config.brightness === undefined) {
				this.myXkeysPanel.setBacklightIntensity(60, config.illuminate_pressed ? 255 : 60)
			}
		} catch (e) {
			this.logger.debug(`Failed to set backlight: ${e}`)
		}

		this.config = config
	}

	/**
	 * When quit is called, close the deck
	 */
	quit() {
		const xkeys = this.myXkeysPanel

		if (xkeys) {
			try {
				xkeys.close()
			} catch (e) {}
		}
	}

	draw(x, y, render) {
		// Should never be used for legacy layout
		if (this.useLegacyLayout) return

		const gridSize = this.gridSize
		if (x < 0 || y < 0 || x >= gridSize.columns || y >= gridSize.rows) return

		const buttonIndex = x * gridSize.rows + y + 1
		const color = render?.style?.bgcolor ?? 0
		this.#drawColorAtIndex(buttonIndex, color)
	}

	drawColor(page, x, y, color) {
		if (!this.useLegacyLayout) return

		const key = convertXYToIndexForPanel(x, y, this.gridSize)
		if (key === undefined) return

		const buttonNumber = page * LEGACY_MAX_BUTTONS + key + 1
		if (buttonNumber <= this.mapCompanionToDevice.length) {
			const buttonIndex = this.mapCompanionToDevice[buttonNumber - 1]

			this.#drawColorAtIndex(buttonIndex, color)
		}
	}

	#drawColorAtIndex(buttonIndex, color) {
		if (buttonIndex === undefined) return

		// Feedback
		const color2 = {
			r: (color >> 16) & 0xff,
			g: 0, // (color >> 8) & 0xff,
			b: color & 0xff,
		}

		const tmpColor = { ...color2 }
		if (this.pressed.has(buttonIndex) && this.config.illuminate_pressed) tmpColor.r = 255

		try {
			this.myXkeysPanel.setBacklight(buttonIndex, tmpColor)
		} catch (e) {
			this.logger.debug(`Failed to set backlight: ${e}`)
		}

		this.lastColors[buttonIndex] = color2
	}
}

export default SurfaceUSBXKeys
