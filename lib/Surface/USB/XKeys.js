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

/**
 * Creates an instance of xkeys.
 * @param {*} system
 * @param {*} devicepath
 * @memberof xkeys
 */
class SurfaceUSBXKeys extends EventEmitter {
	constructor(devicepath, panel, deviceId) {
		super()

		this.logger = LogController.createLogger(`Surface/USB/XKeys/${devicepath}`)

		this.myXkeysPanel = panel
		this.mapDeviceToCompanion = []
		this.mapCompanionToDevice = []

		this.lastColors = []
		this.pressed = new Set()

		this.info = {
			type: `XKeys ${this.myXkeysPanel.info.name}`,
			devicepath: devicepath,
			configFields: ['brightness', 'illuminate_pressed'],
			deviceId: deviceId,
		}

		this.gridSize = {
			columns: global.MAX_BUTTONS_PER_ROW,
			rows: global.MAX_BUTTONS / global.MAX_BUTTONS_PER_ROW,
		}

		this.config = {
			brightness: 60,
			illuminate_pressed: true,
		}

		const { colCount, rowCount } = this.myXkeysPanel.info

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
			const key = this.mapDeviceToCompanion[keyIndex - 1]
			if (key === undefined) {
				return
			}

			this.logger.debug(`keyIndex: ${keyIndex}, companion button: ${key}`)
			this.pressed.add(keyIndex)

			const pageOffset = Math.floor(key / global.MAX_BUTTONS)
			const localKey = key % global.MAX_BUTTONS

			this.#emitClick(localKey, true, pageOffset)

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
			const key = this.mapDeviceToCompanion[keyIndex - 1]
			if (key === undefined) {
				return
			}

			this.logger.debug(`keyIndex: ${keyIndex}, companion button: ${key}`)
			this.pressed.delete(keyIndex)

			const pageOffset = Math.floor(key / global.MAX_BUTTONS)
			const localKey = key % global.MAX_BUTTONS

			this.#emitClick(localKey, false, pageOffset)

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
			this.emit('xkeys-setVariable', 'jog', deltaPos)
			setTimeout(() => {
				this.emit('xkeys-setVariable', 'jog', 0)
			}, 20)
		})
		// Listen to shuttle changes:
		this.myXkeysPanel.on('shuttle', (index, shuttlePos, metadata) => {
			this.logger.silly(`Shuttle ${index} position has changed`, shuttlePos, metadata)
			this.emit('xkeys-setVariable', 'shuttle', shuttlePos)
		})
		// Listen to joystick changes:
		this.myXkeysPanel.on('joystick', (index, position, metadata) => {
			this.logger.silly(`Joystick ${index} position has changed`, position, metadata) // {x, y, z}
			//TODO
			// this.emit('xkeys-setVariable', 'joystick', position)
		})
		// Listen to t-bar changes:
		this.myXkeysPanel.on('tbar', (index, position, metadata) => {
			this.logger.silly(`T-bar ${index} position has changed`, position, metadata)
			this.emit('xkeys-setVariable', 't-bar', position)
		})
	}

	#emitClick(key, state, pageOffset) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, state, pageOffset)
		}
	}

	async #init() {
		this.logger.debug(`Xkeys ${this.myXkeysPanel.info.name} detected`)

		setTimeout(() => {
			const { colCount, rowCount } = this.myXkeysPanel.info
			// Ask companion to provide colours for enough pages of buttons
			this.emit('xkeys-subscribePage', Math.ceil((colCount * rowCount) / global.MAX_BUTTONS))
		}, 1000)
	}

	static async create(devicepath) {
		const panel = await setupXkeysPanel(devicepath)

		try {
			const deviceId = `xkeys:${panel.info.productId}-${panel.info.unitId}` // TODO - this needs some additional uniqueness to the sufix
			// (${devicepath.slice(0, -1).slice(-10)})` // This suffix produces `dev/hidraw` on linux, which is not useful.

			const self = new SurfaceUSBXKeys(devicepath, panel, deviceId)

			await self.#init()

			return self
		} catch (e) {
			panel.close()

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {companion config} config
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

	draw() {
		// Should never be fired
	}

	drawColor(page, x, y, color) {
		// Feedback
		const color2 = {
			r: (color >> 16) & 0xff,
			g: 0, // (color >> 8) & 0xff,
			b: color & 0xff,
		}

		const key = convertXYToIndexForPanel(x, y, this.gridSize)
		if (!key) return

		const buttonNumber = page * global.MAX_BUTTONS + key
		if (buttonNumber <= this.mapCompanionToDevice.length) {
			const buttonIndex = this.mapCompanionToDevice[buttonNumber - 1]
			if (buttonIndex !== undefined) {
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
	}
}

export default SurfaceUSBXKeys
