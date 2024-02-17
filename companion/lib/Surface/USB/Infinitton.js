/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
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

import imageRs from '@julusian/image-rs'
import Infinitton from 'infinitton-idisplay'
import { translateRotation } from '../../Resources/Util.js'
import { EventEmitter } from 'events'
import LogController from '../../Log/Controller.js'
import { convertPanelIndexToXY, convertXYToIndexForPanel } from '../Util.js'

class SurfaceUSBInfinitton extends EventEmitter {
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
	config

	/**
	 * @type {Infinitton}
	 * @access private
	 */
	#infinitton

	/**
	 * @param {string} devicePath
	 */
	constructor(devicePath) {
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
				configFields: ['brightness', 'rotation'],
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
			if (this.#infinitton) {
				this.#infinitton.close()
			}

			throw e
		}
	}

	/**
	 * Produce a click event
	 * @param {number} key
	 * @param {boolean} state
	 */
	#emitClick(key, state) {
		const xy = convertPanelIndexToXY(key, this.gridSize)
		if (xy) {
			this.emit('click', ...xy, state)
		}
	}

	async #init() {
		this.#logger.debug(`Infinitton iDisplay detected`)

		// Make sure the first clear happens properly
		this.clearDeck()
	}

	/**
	 * Open an infinitton
	 * @param {string} devicePath
	 * @returns {Promise<SurfaceUSBInfinitton>}
	 */
	static async create(devicePath) {
		const self = new SurfaceUSBInfinitton(devicePath)

		await self.#init()

		return self
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {Record<string, any>} config
	 * @param {boolean=} force
	 * @returns false when nothing happens
	 */
	setConfig(config, force) {
		if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#infinitton.setBrightness(config.brightness)
		}

		this.config = config
	}

	quit() {
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
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	draw(x, y, render) {
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

				const newbuffer = image.toBufferSync(imageRs.PixelFormat.Rgb)
				this.#infinitton.fillImage(key, newbuffer)
			} catch (/** @type {any} */ e) {
				this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		}
	}

	/**
	 * @param {number} input
	 * @returns {number}
	 */
	#mapButton(input) {
		const map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
		if (input < 0) {
			return -1
		}

		return parseInt(map[input])
	}

	/**
	 * @param {number} input
	 * @returns {number | undefined}
	 */
	#reverseButton(input) {
		const map = '4 3 2 1 0 9 8 7 6 5 14 13 12 11 10'.split(/ /)
		for (let pos = 0; pos < map.length; pos++) {
			if (Number(map[input]) == pos) return pos
		}

		return
	}

	clearDeck() {
		this.#logger.debug('infinitton.prototype.clearDeck()')

		const keysTotal = this.gridSize.columns * this.gridSize.rows
		for (let x = 0; x < keysTotal; x++) {
			this.#infinitton.clearKey(x)
		}
	}
}

export default SurfaceUSBInfinitton
