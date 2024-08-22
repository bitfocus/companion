/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>, Nengzhuo Cai <Null@203.io>
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
 *
 */

import { EventEmitter } from 'events'
import LogController from '../../Log/Controller.js'
import { HIDAsync } from 'node-hid'
import { colorToRgb } from './Util.js'

/**
 * This is an implementation of a simple MIDI device for the 203 Electronics Matrix control surface.
 * Hardware: https://203.io/
 * It uses a specific OS available from https://github.com/203Electronics/MatrixOS
 * This driver targets the Matrix OS's Performance APP,
 * but will switch to an HID implementation in the future with a dedicated app.
 */
class SurfaceUSB203Matrix extends EventEmitter {
	/**
	 * @type {import('winston').Logger}
	 * @access private
	 * @readonly
	 */
	#logger

	/**
	 * @type {Record<string, any>}
	 * @access private
	 */
	config = {}

	/**
	 * HID device
	 * @type {import('node-hid').HIDAsync}
	 * @access private
	 * @readonly
	 */
	#device

	/**
	 * @param {string} devicePath
	 * @param {import('node-hid').HIDAsync} device // TODO Change to Midi
	 */
	constructor(devicePath, device) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/203Matrix/${devicePath}`)

		this.config = {
			brightness: 100,
		}

		this.#logger.debug(`Adding 203 Matrix USB device: ${devicePath}`)

		this.#device = device

		this.info = {
			type: `203 Electronics Matrix`,
			devicePath: devicePath,
			configFields: [],
			deviceId: `203-matrix`,
		}

		this.gridSize = {
			columns: 8,
			rows: 8,
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
	 * Open a 203 Matrix
	 * @param {string} devicePath
	 * @returns {Promise<SurfaceUSB203Matrix>}
	 */
	static async create(devicePath) {
		const device = await HIDAsync.open(devicePath)

		try {
			const self = new SurfaceUSB203Matrix(devicePath, device)

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
	 * @param {Record<string, any>} config
	 * @param {boolean=} force
	 * @returns false when nothing happens
	 */
	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#updateBrightness(config.brightness)
		}

		this.config = config
	}

	quit() {
		this.#clearPanel()
			.catch((e) => {
				this.#logger.debug(`Clear deck failed: ${e}`)
			})
			.then(() => {
				//close after the clear has been sent
				this.#device.close()  // TODO
			})
	}

	clearDeck() {
		this.#clearPanel().catch((e) => {
			this.#logger.debug(`Clear deck failed: ${e}`)
		})
	}

	#clearPanel() { // TODO
		const clearBuffer = Buffer.alloc(32)
		clearBuffer.writeUint8(0x0b, 0)
		return this.#device.write(clearBuffer)
	}

	/**
	 * Draw a button
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	draw(x, y, render) {
		const color = render.style ? colorToRgb(render.bgcolor) : { r: 0, g: 0, b: 0 }
		this.#writeKeyColour(x, y, color)
	}

	/**
	 *
	 * @param {number} x
	 * @param {number} y
	 * @param {{ r: number, g: number, b: number }} color
	 */
	#writeKeyColour(x, y, color) {  // TODO
		const fillBuffer = Buffer.alloc(32)
		fillBuffer.writeUint8(0x0f, 0)
		fillBuffer.writeUint8(x + 1, 1)
		fillBuffer.writeUint8(y + 1, 2)

		fillBuffer.writeUint8(color.r, 3)
		fillBuffer.writeUint8(color.g, 4)
		fillBuffer.writeUint8(color.b, 5)

		this.#device.write(fillBuffer).catch((e) => {
			this.#logger.error(`write failed: ${e}`)
		})
	}

	/**
	 * @param {number} brightness
	 */
	#updateBrightness(brightness) {
		// TODO
	}
}

export default SurfaceUSB203Matrix
