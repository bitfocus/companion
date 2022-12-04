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

const util = require('util')
const debug = require('debug')('lib/usb/xkeys')
const common = require('./common')
const { setupXkeysPanel } = require('xkeys')

/**
 * Creates an instance of xkeys.
 * @param {*} system
 * @param {*} devicepath
 * @memberof xkeys
 */
class xkeys {
	constructor(system, devicepath) {
		util.inherits(xkeys, common)
		this.debug = debug
		this.system = system
		this.internal = {
			label: 'internal',
		}
		this.myXkeysPanel
		this.map = []
		this.mapReverse = []
		this.info = {}
		this.type = this.info.type = 'XKeys device'
		this.info.config = ['brightness']
		this.info.keysPerRow, this.info.keysPerColumn, this.info.keysTotal
		this.currentPage = 1
		this.config = {
			brightness: 60,
			page: 1,
			enable_device: true,
		}
		this.info.devicepath = this.devicepath = devicepath

		// Feedback
		// TODO initial colors
		this.system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
			let color = this.decimalToRgb(bgcolor)
			let buttonNumber = (parseInt(page) - this.currentPage) * 32 + parseInt(bank)
			if (buttonNumber <= this.mapReverse.length) {
				let buttonIndex = parseInt(this.mapReverse[buttonNumber - 1])
				this.myXkeysPanel.setBacklight(buttonIndex, color)
			}
			this.log(`graphics_set_bank_bg received in xkeys ${page}, ${bank}, ${color.red}`)
		})

		// Connect to xkeys
		setupXkeysPanel(devicepath)
			.then((xkeysPanel) => {
				this.system.emit('log', 'xkeys USB device:', 'info', xkeysPanel.info.name + ' added')
				console.log(`Connected to ${xkeysPanel.info.name}`)
				this.myXkeysPanel = xkeysPanel
				this.info.keysPerColumn = this.myXkeysPanel.info.rowCount
				this.info.keysPerRow = this.myXkeysPanel.info.colCount
				this.info.keysTotal = this.info.keysPerColumn * this.info.keysPerRow
				// Mapping buttons
				for (var leftRight = 0; leftRight < this.info.keysPerRow; leftRight++) {
					for (var topBottom = 0; topBottom < this.info.keysPerColumn; topBottom++) {
						this.map.push(leftRight + topBottom * this.info.keysPerRow)
					}
				}
				// Mapping for feedback
				for (let topBottom = 1; topBottom <= this.info.keysPerColumn; topBottom++) {
					for (let leftRight = 0; leftRight < this.info.keysPerRow; leftRight++) {
						this.mapReverse.push(topBottom + leftRight * this.info.keysPerColumn)
					}
				}
				console.log(this.map)
				this.info.serialnumber = this.serialnumber = `${xkeysPanel.info.name} (${this.devicepath
					.slice(0, -1)
					.slice(-10)})`

				// Set brightness at startup
				this.myXkeysPanel.setBacklightIntensity((this.config.brightness = 60), 255)

				// Call this to get the latest info into the object
				this.finish_add()

				this.system.emit('log', `device(${this.serialnumber})`, 'debug', `${this.myXkeysPanel.info.name} detected`)

				this.myXkeysPanel.on('disconnected', () => {
					console.log(`X-keys panel of type ${this.myXkeysPanel.info.name} was disconnected`)
					// Clean up stuff
					this.myXkeysPanel.removeAllListeners()
					this.system.emit('elgatodm_remove_device', devicepath)
				})

				this.myXkeysPanel.on('error', (...errs) => {
					console.log('X-keys error:', ...errs)
					this.system.emit('elgatodm_remove_device', devicepath)
				})

				// Listen to pressed buttons:
				this.myXkeysPanel.on('down', (keyIndex, metadata) => {
					let key = this.convertButton(keyIndex)
					if (key === undefined) {
						return
					}
					this.system.emit(
						'log',
						`device(${this.serialnumber})`,
						'debug',
						`xkey keyIndex: ${keyIndex}, companion button: ${key}`
					)
					let newKey = this.setPageKey(key)
					this.system.emit('elgato_click', this.myXkeysPanel.devicePath, newKey, true)

					// Light up a button when pressed:
					this.myXkeysPanel.setIndicatorLED(1, true)
					this.myXkeysPanel.setBacklight(keyIndex, 'red')
				})
				// Listen to released buttons:
				this.myXkeysPanel.on('up', (keyIndex, metadata) => {
					let key = this.convertButton(keyIndex)
					if (key === undefined) {
						return
					}
					let newKey = this.setPageKey(key)
					this.system.emit('elgato_click', this.myXkeysPanel.devicePath, newKey, false)

					// Turn off button light when released:
					this.myXkeysPanel.setIndicatorLED(1, false)
					this.myXkeysPanel.setBacklight(keyIndex, false)
				})
				// Listen to jog wheel changes:
				this.myXkeysPanel.on('jog', (index, deltaPos, metadata) => {
					console.log(`Jog ${index} position has changed`, deltaPos, metadata)
					this.system.emit('variable_instance_set', this.internal, 'jog', deltaPos)
				})
				// Listen to shuttle changes:
				this.myXkeysPanel.on('shuttle', (index, shuttlePos, metadata) => {
					console.log(`Shuttle ${index} position has changed`, shuttlePos, metadata)
					this.system.emit('variable_instance_set', this.internal, 'shuttle', shuttlePos)
				})
				// Listen to joystick changes:
				this.myXkeysPanel.on('joystick', (index, position, metadata) => {
					console.log(`Joystick ${index} position has changed`, position, metadata) // {x, y, z}
					//TODO
					// this.system.emit('variable_instance_set', this.internal, 'joystick', position)
				})
				// Listen to t-bar changes:
				this.myXkeysPanel.on('tbar', (index, position, metadata) => {
					console.log(`T-bar ${index} position has changed`, position, metadata)
					this.system.emit('variable_instance_set', this.internal, 't-bar', position)
				})
			})
			.catch((e) => {
				// Probably in a broken state, so disconnect
				console.error(`Error while setting up xkeys: ${e}`)
				this.system.emit('elgatodm_remove_device', devicepath)
			})
	}

	/**
	 * When ready do a elgato_ready
	 */
	setImmediate() {
		this.system.emit('elgato_ready', devicepath)
	}

	/**
	 * Convert decimal colors from companion to RGB
	 * @param {number} decimal
	 * @returns object { r, g, b}
	 */
	decimalToRgb(decimal) {
		return {
			r: (decimal >> 16) & 0xff,
			g: (decimal >> 8) & 0xff,
			b: decimal & 0xff,
		}
	}

	/**
	 * Convert a button to page and button
	 * @param {number} key
	 * @returns the companion button
	 */
	setPageKey(key) {
		let pageNumber = parseInt(key / 32) + 1
		key = key - (pageNumber - 1) * 32
		pageNumber = pageNumber + this.config.page - 1
		// if (this.currentPage !== pageNumber) {
		this.system.emit('device_page_set', this.serialnumber, pageNumber)
		this.currentPage = pageNumber
		// }
		return key
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {companion config} config
	 * @returns false when nothing happens
	 */
	setConfig(config) {
		if (this.config.brightness != config.brightness && config.brightness !== undefined) {
			this.myXkeysPanel.setBacklightIntensity(config.brightness * 2.55, 255)
		} else if (config.brightness === undefined) {
			this.myXkeysPanel.setBacklightIntensity(60, 255)
		}

		// Create a page offset for the xkeys
		if (this.config.page != config.page && config.page !== undefined) {
			this.config.page = config.page
		}

		this.config = config

		return false // no reason to redraw
	}

	/**
	 * When quit is called, close the deck
	 */
	quit() {
		let xkeys = this.myXkeysPanel

		if (xkeys !== undefined) {
			try {
				xkeys.close
			} catch (e) {}
		}
	}

	/**
	 * Start but not quite sure if needed
	 */
	begin() {
		this.log('xkeys.prototype.begin()')
	}

	/**
	 * Give button from xkeys and fetch out corresponding companion button from the array
	 * @param {number} input
	 * @returns companion key
	 */
	convertButton(input) {
		return parseInt(this.map[input - 1])
	}

	draw() {
		// Ignore
	}
}

exports = module.exports = xkeys
