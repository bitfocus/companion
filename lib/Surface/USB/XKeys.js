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

import { setupXkeysPanel } from 'xkeys'

/**
 * Creates an instance of xkeys.
 * @param {*} system
 * @param {*} devicepath
 * @memberof xkeys
 */
class SurfaceUSBXKeys {
	constructor(ipcWrapper, devicepath, panel, serialnumber) {
		this.ipcWrapper = ipcWrapper
		this.myXkeysPanel = panel

		this.mapDeviceToCompanion = []
		this.mapCompanionToDevice = []

		this.lastColors = []
		this.pressed = new Set()

		this.info = {
			type: `XKeys ${this.myXkeysPanel.info.name}`,
			devicepath: devicepath,
			configFields: ['brightness', 'illuminate_pressed'],
			serialnumber: serialnumber,

			keysPerRow: global.MAX_BUTTONS_PER_ROW,
			keysTotal: global.MAX_BUTTONS,
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
			console.log(`X-keys panel of type ${this.myXkeysPanel.info.name} was disconnected`)
			// Clean up stuff
			this.myXkeysPanel.removeAllListeners()
			this.ipcWrapper.remove()
		})

		this.myXkeysPanel.on('error', (...errs) => {
			console.log('X-keys error:', ...errs)
			this.ipcWrapper.remove()
		})

		// Listen to pressed buttons:
		this.myXkeysPanel.on('down', (keyIndex, metadata) => {
			const key = this.mapDeviceToCompanion[keyIndex - 1]
			if (key === undefined) {
				return
			}

			this.ipcWrapper.log('debug', `keyIndex: ${keyIndex}, companion button: ${key}`)
			this.pressed.add(keyIndex)

			const pageOffset = Math.floor(key / global.MAX_BUTTONS)
			const localKey = key % global.MAX_BUTTONS

			this.ipcWrapper.click(localKey, true, pageOffset)

			// Light up a button when pressed:
			this.myXkeysPanel.setIndicatorLED(1, true)
			if (this.config.illuminate_pressed) {
				this.myXkeysPanel.setBacklight(keyIndex, 'red')
			}
		})

		// Listen to released buttons:
		this.myXkeysPanel.on('up', (keyIndex, metadata) => {
			const key = this.mapDeviceToCompanion[keyIndex - 1]
			if (key === undefined) {
				return
			}

			this.ipcWrapper.log('debug', `keyIndex: ${keyIndex}, companion button: ${key}`)
			this.pressed.delete(keyIndex)

			const pageOffset = Math.floor(key / global.MAX_BUTTONS)
			const localKey = key % global.MAX_BUTTONS

			this.ipcWrapper.click(localKey, false, pageOffset)

			// Turn off button light when released:
			this.myXkeysPanel.setIndicatorLED(1, false)
			if (this.config.illuminate_pressed) {
				this.myXkeysPanel.setBacklight(keyIndex, this.lastColors[keyIndex] || false)
			}
		})

		// Listen to jog wheel changes:
		this.myXkeysPanel.on('jog', (index, deltaPos, metadata) => {
			console.log(`Jog ${index} position has changed`, deltaPos, metadata)
			this.ipcWrapper.xkeysSetVariable('jog', deltaPos)
		})
		// Listen to shuttle changes:
		this.myXkeysPanel.on('shuttle', (index, shuttlePos, metadata) => {
			console.log(`Shuttle ${index} position has changed`, shuttlePos, metadata)
			this.ipcWrapper.xkeysSetVariable('shuttle', shuttlePos)
		})
		// Listen to joystick changes:
		this.myXkeysPanel.on('joystick', (index, position, metadata) => {
			console.log(`Joystick ${index} position has changed`, position, metadata) // {x, y, z}
			//TODO
			// this.ipcWrapper.xkeysSetVariable('joystick', position)
		})
		// Listen to t-bar changes:
		this.myXkeysPanel.on('tbar', (index, position, metadata) => {
			console.log(`T-bar ${index} position has changed`, position, metadata)
			this.ipcWrapper.xkeysSetVariable('t-bar', position)
		})
	}

	async #init() {
		this.ipcWrapper.log('debug', `Xkeys ${this.myXkeysPanel.info.name} detected`)

		setTimeout(() => {
			const { colCount, rowCount } = this.myXkeysPanel.info
			// Ask companion to provide colours for enough pages of buttons
			this.ipcWrapper.xkeysSubscribePages(Math.ceil((colCount * rowCount) / global.MAX_BUTTONS))
		}, 1000)
	}

	static async create(ipcWrapper, devicepath) {
		const panel = await setupXkeysPanel(devicepath)

		const serialnumber = `xkeys:${panel.info.productId}-${panel.info.unitId}` // TODO - this needs some additional uniqueness to the sufix
		// (${devicepath.slice(0, -1).slice(-10)})` // This suffix produces `dev/hidraw` on linux, which is not useful.

		const self = new SurfaceUSBXKeys(ipcWrapper, devicepath, panel, serialnumber)

		await self.#init()

		return self
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {companion config} config
	 * @returns false when nothing happens
	 */
	setConfig(config) {
		if (
			(this.config.brightness != config.brightness && config.brightness !== undefined) ||
			this.config.illuminate_pressed !== config.illuminate_pressed
		) {
			const intensity = config.brightness * 2.55
			this.myXkeysPanel.setBacklightIntensity(intensity, config.illuminate_pressed ? 255 : intensity)
		} else if (config.brightness === undefined) {
			this.myXkeysPanel.setBacklightIntensity(60, config.illuminate_pressed ? 255 : 60)
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

	drawColor(page, key, color) {
		// Feedback
		const color2 = {
			r: (color >> 16) & 0xff,
			g: 0, // (color >> 8) & 0xff,
			b: color & 0xff,
		}

		const buttonNumber = page * global.MAX_BUTTONS + key
		if (buttonNumber <= this.mapCompanionToDevice.length) {
			const buttonIndex = this.mapCompanionToDevice[buttonNumber - 1]
			if (buttonIndex !== undefined) {
				const tmpColor = { ...color2 }
				if (this.pressed.has(buttonIndex) && this.config.illuminate_pressed) tmpColor.r = 255

				this.myXkeysPanel.setBacklight(buttonIndex, tmpColor)

				this.lastColors[buttonIndex] = color2
			}
		}

		this.ipcWrapper.log('debug', `graphics_set_bank_bg received in xkeys ${page}, ${key}, r:${color2.r}, b:${color2.b}`)
	}
}

export default SurfaceUSBXKeys
