/*
 * This file is part of the Companion project
 * Copyright (c) 2021 VICREO BV
 * Author: Jeffrey Davidsz <jeffrey.davidsz@vicreo.eu>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */

const util = require('util')
const debug = require('debug')('lib/usb/xkeys')
const common = require('./common')
const xkeys_settings = require('./xkeys_products')
const HID = require('node-hid')
let log

class xkeys {
	constructor(system, devicepath) {
		util.inherits(xkeys, common)
		this.debug = debug
		this.system = system
		this.internal = {
			label: 'internal',
		}
		this.myXkeysPanel
		this._buttonStates = {}
		this._analogStates = {}
		this.map = []
		this.mapReverse = []
		this.device_type = 'Xkeys'
		this.info = {}
		this.type = this.info.type = 'XKeys device'
		this.info.device_type = 'XKeys'
		this.info.config = ['brightness', 'page', 'enable_device']
		this.info.keysPerRow = 10
		this.info.keysTotal = 80
		this.config = {
			brightness: 10,
			keysPerRow: 10,
			keysPerColumn: 8,
			tbarPosition: 0,
			jog: 0,
			shuttle: 0,
			joystick: 0,
			page: 1,
			bits: 8,
			enable_device: true,
		}
		this.info.devicepath = this.devicepath = devicepath

		this.system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
			let color = this.decimalToRgb(bgcolor)
			let buttonNumber = parseInt(page) * 32 - parseInt(this.config.page) * 32 + parseInt(bank)
			let buttonIndex = parseInt(this.mapReverse[buttonNumber - 1])
			color.red > 125
				? this.setBacklight(buttonIndex, true, true, false) && this.setBacklight(buttonIndex, false, false, false)
				: this.setBacklight(buttonIndex, false, true, false) && this.setBacklight(buttonIndex, true, false, false)

			this.log(`graphics_set_bank_bg received in xkeys ${page}, ${bank}, ${color.red}`)
		})

		// common.apply(this, arguments);
		this.createXkeysDevice(devicepath)
	}

	createXkeysDevice(devicepath) {
		const devices = HID.devices()
		this.myXkeysPanel = new HID.HID(devicepath)
		this.myXkeysPanel.deviceType = xkeys_settings.models[0]
		devices.forEach((element) => {
			if (element.path == devicepath) {
				let productId = element.productId
				xkeys_settings.models.forEach((model) => {
					if (model.productId.indexOf(productId) != -1) {
						this.myXkeysPanel.deviceType = model
					}
				})
			}
		})
		this.log('Adding xkeys USB device:', this.myXkeysPanel.deviceType.identifier)

		this.buttonState = []
		this.info.serialnumber = this.serialnumber = this.myXkeysPanel.deviceType.identifier

		this.config.keysPerRow = this.myXkeysPanel.deviceType.columns
		this.config.keysPerColumn = this.myXkeysPanel.deviceType.bankSize / this.myXkeysPanel.deviceType.columns
		if (this.myXkeysPanel.deviceType.productId == '999') {
			this.system.emit('log', 'Unkown XKEYS model', 'error', 'Please file an issue on github or slack')
		} else {
			this.system.emit('log', 'device(' + this.myXkeysPanel.deviceType.identifier + ')', 'info', 'XKeys detected')
		}
		// Mapping buttons
		for (var leftRight = 0; leftRight < this.config.keysPerRow; leftRight++) {
			for (var topBottom = 0; topBottom < this.config.bits; topBottom++) {
				this.map.push(topBottom * this.config.keysPerRow + leftRight)
			}
		}
		// Mapping buttons for feedback
		for (var topBottom = 0; topBottom < this.config.bits; topBottom++) {
			for (var leftRight = 0; leftRight < this.config.keysPerRow; leftRight++) {
				this.mapReverse.push(leftRight * this.config.bits + topBottom)
			}
		}
		// How many items we have left to load until we're ready to begin
		this.loadingItems = 0
		// disable red lights
		if (this.config.enable_device) this.setAllBacklights(true, false) && this.setAllBacklights(false, true)

		this.myXkeysPanel.on('data', (data) => {
			//Ignore companion presses
			if (this.config.enable_device == undefined || this.config.enable_device == null) {
				this.config.enable_device = true
			} else if (!this.config.enable_device) return

			const buttonStates = {}
			const analogStates = {}

			// Calculate keys
			for (let x = 0; x < this.myXkeysPanel.deviceType.columns; x++) {
				for (let y = 0; y < this.myXkeysPanel.deviceType.rows; y++) {
					const keyIndex = x * 8 + y
					const d = data.readUInt32LE(2 + x)
					const bit = d & (1 << y) ? true : false
					buttonStates[keyIndex] = bit
				}
			}
			// Jog
			if (this.myXkeysPanel.deviceType.hasJog) {
				const d = data[(this.myXkeysPanel.deviceType.jogByte || 0) - 2] // Jog
				analogStates.jog = d < 128 ? d : d - 256
			}
			// Shuttle
			if (this.myXkeysPanel.deviceType.hasShuttle) {
				const d = data[(this.myXkeysPanel.deviceType.shuttleByte || 0) - 2] // Shuttle
				analogStates.shuttle = d < 128 ? d : d - 256
			}
			// Joystick
			if (this.myXkeysPanel.deviceType.hasJoystick) {
				let d = data.readUInt32LE(7) // Joystick X
				analogStates.joystick_x = d < 128 ? d : d - 256

				d = data.readUInt32LE(8) // Joystick Y
				analogStates.joystick_y = d < 128 ? d : d - 256

				d = data.readUInt32LE(9) // Joystick Z (twist of joystick)
				analogStates.joystick_z = d < 128 ? d : d - 256
			}
			// tbar
			if (this.myXkeysPanel.deviceType.hasTbar) {
				let d = data[(this.myXkeysPanel.deviceType.tbarByte || 0) - 2] // T-bar (calibrated)
				analogStates.tbar = d

				d = data.readUInt16BE((this.myXkeysPanel.deviceType.tbarByteRaw || 0) - 2) // T-bar (uncalibrated)
				analogStates.tbar_raw = d
			}
			// Disabled/nonexisting keys:
			if (this.myXkeysPanel.deviceType.disableKeys) {
				this.myXkeysPanel.deviceType.disableKeys.forEach((keyIndex) => {
					buttonStates[keyIndex] = false
				})
			}
			// Process keypress
			for (const buttonStateKey in buttonStates) {
				// compare with previous button states:
				if ((this._buttonStates[buttonStateKey] || false) !== buttonStates[buttonStateKey]) {
					if (buttonStates[buttonStateKey]) {
						// key is pressed
						// this.system.emit('log', 'device(' + this.myXkeysPanel.deviceType.identifier + ')', 'debug', 'XKeys original press: ' + buttonStateKey);
						let key = this.convertButton(buttonStateKey)
						if (key === undefined) {
							return
						}

						let newKey = this.setPageKey(key)
						this.buttonState[key] = true
						this.system.emit('elgato_click', devicepath, newKey, true, this.buttonState)
						// Set RED backlight on while pressing
						this.setBacklight(buttonStateKey, true, false, false)
						this.setLED(1, true, false)
					} else {
						let key = this.convertButton(buttonStateKey)
						if (key === undefined) {
							return
						}
						let newKey = this.setPageKey(key)
						this.buttonState[key] = false
						this.system.emit('elgato_click', devicepath, newKey, false, this.buttonState)
						this.setBacklight(buttonStateKey, false, false, false)
						this.setLED(1, false, false)
					}
				}
			}
			// Process analogStates
			for (const analogStateKey in analogStates) {
				// compare with previous states:
				if ((this._analogStates[analogStateKey] || 0) !== analogStates[analogStateKey]) {
					if (analogStateKey === 'jog') {
						this.config.jog = analogStates[analogStateKey]
						this.system.emit('variable_instance_set', this.internal, 'jog', analogStates[analogStateKey])
						this.log('Jog position has changed: ' + analogStates[analogStateKey])
					} else if (analogStateKey === 'shuttle') {
						this.config.shuttle = analogStates[analogStateKey]
						this.system.emit('variable_instance_set', this.internal, 'shuttle', analogStates[analogStateKey])
						this.log('Shuttle position has changed: ' + analogStates[analogStateKey])
					} else if (analogStateKey === 'tbar_raw') {
						this.config.tbarPosition = analogStates.tbar
						this.system.emit('variable_instance_set', this.internal, 't-bar', analogStates.tbar)
						this.log(
							'T-bar position has changed: ' +
								this.config.tbarPosition +
								' (uncalibrated: ' +
								analogStates.tbar_raw +
								')'
						)
					} else if (
						analogStateKey === 'joystick_x' ||
						analogStateKey === 'joystick_y' ||
						analogStateKey === 'joystick_z'
					) {
						this.config.joystick = analogStates
						this.system.emit('variable_instance_set', this.internal, 'joystick', analogStates)
						this.log('Joystick has changed:' + analogStates) // {x, y, z}
						this.log('joystick', {
							x: analogStates.joystick_x,
							y: analogStates.joystick_y,
							z: analogStates.joystick_z,
						})
					} else if (
						analogStateKey !== 'tbar' // ignore tbar updates because event is emitted on tbar_raw update
					) {
						this.system.emit('log', 'Unknown analogStateKey:', 'error', analogStateKey)
					}
				}
			}
			this._buttonStates = buttonStates
			this._analogStates = analogStates
		})

		this.myXkeysPanel.on('error', (error) => {
			this.log(error)
			this.system.emit('elgatodm_remove_device', devicepath)
		})
	}
	// send xkeys ready message to devices :)
	setImmediate() {
		this.system.emit('elgato_ready', devicepath)
	}

	decimalToRgb(decimal) {
		return {
			red: (decimal >> 16) & 0xff,
			green: (decimal >> 8) & 0xff,
			blue: decimal & 0xff,
		}
	}
	/**
	 * Sets the backlight of a key
	 * @param {keyIndex} the key to set the color of
	 * @param {on} boolean: on or off
	 * @param {flashing} boolean: flashing or not (if on)
	 * @returns undefined
	 */
	setBacklight(keyIndex, on, redLight, flashing) {
		if (keyIndex === 'PS') return // PS-button has no backlight

		this.verifyKeyIndex(keyIndex)

		if (redLight) {
			keyIndex =
				(typeof keyIndex === 'string' ? parseInt(keyIndex, 10) : keyIndex) +
				(this.myXkeysPanel.deviceType.bankSize || 0)
		}
		const message = this.padMessage([0, 181, keyIndex, on ? (flashing ? 2 : 1) : 0, 1])
		this.write(message)
	}
	/**
	 * Sets the backlightintensity of the device
	 * @param {intensity} 0-100 (will be converted to 0-255)
	 */
	setBacklightIntensity(blueIntensity, redIntensity) {
		if (redIntensity === undefined) redIntensity = 100

		blueIntensity = Math.max(Math.min(Math.round(blueIntensity * 2.55), 255), 0)
		redIntensity = Math.max(Math.min(Math.round(redIntensity * 2.55), 255), 0)

		const message =
			this.myXkeysPanel.deviceType.banks === 2
				? this.padMessage([0, 187, blueIntensity, redIntensity])
				: this.padMessage([0, 187, blueIntensity])
		this.write(message)
	}
	/**
	 * Sets the backlight of all keys
	 * @param {on} boolean: on or off
	 * @param {redLight} boolean: if to set the red or blue backlights
	 * @returns undefined
	 */
	setAllBacklights(on, redLight) {
		const message = this.padMessage([0, 182, redLight ? 1 : 0, on ? 255 : 0])
		this.write(message)
	}

	/**
	 * Writes a Buffer to the X-keys device
	 *
	 * @param {Buffer} buffer The buffer written to the device
	 * @returns undefined
	 */
	write(anyArray) {
		const intArray = []
		for (const i in anyArray) {
			const v = anyArray[i]
			intArray[i] = typeof v === 'string' ? parseInt(v, 10) : v
		}
		try {
			// device.write([0x00, 0x01, 0x01, 0x05, 0xff, 0xff]);
			this.myXkeysPanel.write(intArray)
			// return this.device.write(intArray)
		} catch (e) {
			this.log('error', e)
		}
	}

	setPageKey(key) {
		if (key > 31) {
			let pageNumber = parseInt(key / 32) + 1
			key = key - (pageNumber - 1) * 32
			pageNumber = pageNumber + this.config.page - 1
			this.system.emit('device_page_set', this.serialnumber, pageNumber)
			return key
		} else {
			this.system.emit('device_page_set', this.serialnumber, this.config.page)
			return key
		}
	}

	getConfig() {
		return this.config
	}
	//TODO
	setConfig(config) {
		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			this.setBacklightIntensity(config.brightness, 100)
		} else {
			this.setBacklightIntensity(10)
		}

		if (this.config.page != config.page && config.page !== undefined) {
			this.config.page = config.page
		}
		if (this.config.enable_device != config.enable_device && config.enable_device !== undefined) {
			this.config.enable_device = config.enable_device
			this.config.enable_device
				? this.system.emit('log', 'device(' + this.myXkeysPanel.deviceType.identifier + ')', 'info', 'XKeys enabled')
				: this.system.emit('log', 'device(' + this.myXkeysPanel.deviceType.identifier + ')', 'error', 'XKeys disabled')
		}

		this.config = config
	}
	//TODO
	quit() {
		let xkeys = this.myXkeysPanel

		if (xkeys !== undefined) {
			try {
				this.clearDeck()
			} catch (e) {}

			// Find the actual xkeys driver, to talk to the device directly
			if (xkeys.device === undefined && this.myXkeysPanel !== undefined) {
				xkeys = this.myXkeysPanel
			}

			// If an actual xkeys is connected, disconnect
			if (xkeys.device !== undefined) {
				xkeys.device.close()
			}
		}
	}

	begin() {
		this.log('xkeys.prototype.begin()')

		this.setBacklightIntensity(this.config.brightness)
	}

	padMessage(message) {
		const messageLength = 36
		while (message.length < messageLength) {
			message.push(0)
		}
		return message
	}

	convertButton(input) {
		return parseInt(this.map[input])
	}

	verifyKeyIndex(keyIndex) {
		keyIndex = typeof keyIndex === 'string' ? parseInt(keyIndex, 10) : keyIndex
		if (!(keyIndex >= 0 && keyIndex < 8 * this.myXkeysPanel.deviceType.columns)) {
			this.log(`Invalid keyIndex: ${keyIndex}`)
		}
	}

	/**
	 * Sets the LED of a key
	 * @param {keyIndex} the LED to set the color of (0 = green, 1 = red)
	 * @param {on} boolean: on or off
	 * @param {flashing} boolean: flashing or not (if on)
	 * @returns undefined
	 */
	setLED(keyIndex, on, flashing) {
		let ledIndex = 0
		if (keyIndex === 0) ledIndex = 6
		if (keyIndex === 1) ledIndex = 7

		const message = this.padMessage([0, 179, ledIndex, on ? (flashing ? 2 : 1) : 0])
		this.write(message)
	}
}
exports = module.exports = xkeys
