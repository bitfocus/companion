/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Julian Waller <me@julusian.co.uk>
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
import { colorToRgb } from './Util.js'
import { openBlackmagicController } from '@blackmagic-controller/node'
import debounceFn from 'debounce-fn'
import { ImageResult } from '../../Graphics/ImageResult.js'
import { LockConfigFields, OffsetConfigFields, RotationConfigField } from '../CommonConfigFields.js'

/**
 * @type {import('@companion-app/shared/Model/Surfaces.js').CompanionSurfaceConfigField[]}
 */
const configFields = [
	//
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,
]

export class SurfaceUSBBlackmagicController extends EventEmitter {
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
	 * @type {import('@blackmagic-controller/node').BlackmagicController}
	 * @access private
	 * @readonly
	 */
	#device

	/**
	 * @param {string} devicePath
	 * @param {import('@blackmagic-controller/node').BlackmagicController} blackmagicController
	 */
	constructor(devicePath, blackmagicController) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/BlackmagicController/${devicePath}`)

		this.config = {}

		this.#logger.debug(`Adding framework-macropad USB device: ${devicePath}`)

		this.#device = blackmagicController

		/** @type {import('../Handler.js').SurfacePanelInfo} */
		this.info = {
			type: `Blackmagic ${this.#device.PRODUCT_NAME}`,
			devicePath: devicePath,
			configFields: configFields,
			deviceId: `blackmagic-controller`, // set in #init()
		}

		const allRowValues = this.#device.CONTROLS.map((control) => control.row)
		const allColumnValues = this.#device.CONTROLS.map((button) => button.column)

		const gridSpan = {
			// minRow: Math.min(...allRowValues),
			maxRow: Math.max(...allRowValues),
			// minCol: Math.min(...allColumnValues),
			maxCol: Math.max(...allColumnValues),
		}

		this.gridSize = {
			columns: gridSpan.maxCol + 1,
			rows: gridSpan.maxRow + 1,
		}

		this.#device.on('error', (error) => {
			this.#logger.error(`Error: ${error}`)
			this.emit('remove')
		})

		this.#device.on('down', (control) => {
			this.emit('click', control.column, control.row, true)
		})

		this.#device.on('up', (control) => {
			this.emit('click', control.column, control.row, false)
		})

		this.#device.on('tbar', (_control, value) => {
			this.#logger.silly(`T-bar position has changed`, value)
			this.emit('setVariable', 't-bar', Math.round(value * 255))
		})
	}
	async #init() {
		const serialNumber = await this.#device.getSerialNumber()
		this.info.deviceId = `blackmagic:${serialNumber}`

		// Make sure the first clear happens properly
		await this.#device.clearPanel()
	}

	/**
	 * Open a framework macropad
	 * @param {string} devicePath
	 * @returns {Promise<SurfaceUSBBlackmagicController>}
	 */
	static async create(devicePath) {
		const blackmagicController = await openBlackmagicController(devicePath)

		try {
			const self = new SurfaceUSBBlackmagicController(devicePath, blackmagicController)

			/** @type {any} */
			let errorDuringInit = null
			const tmpErrorHandler = (/** @type {any} */ error) => {
				errorDuringInit = errorDuringInit || error
			}

			// Ensure that any hid error during the init call don't cause a crash
			self.on('error', tmpErrorHandler)

			await self.#init()

			if (errorDuringInit) throw errorDuringInit
			self.off('error', tmpErrorHandler)

			return self
		} catch (e) {
			await blackmagicController.close().catch(() => null)

			throw e
		}
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @param {Record<string, any>} config
	 * @param {boolean=} _force
	 * @returns false when nothing happens
	 */
	setConfig(config, _force) {
		// if ((force || this.config.brightness != config.brightness) && config.brightness !== undefined) {
		// 	for (let y = 0; y < this.gridSize.rows; y++) {
		// 		for (let x = 0; x < this.gridSize.columns; x++) {
		// 			const color = this.#lastColours[`${x},${y}`] ?? { r: 0, g: 0, b: 0 }
		// 			this.#writeKeyColour(x, y, color)
		// 		}
		// 	}
		// }

		this.config = config
	}

	quit() {
		this.#device
			.clearPanel()
			.catch((e) => {
				this.#logger.debug(`Clear deck failed: ${e}`)
			})
			.then(() => {
				//close after the clear has been sent
				this.#device.close().catch(() => null)
			})
	}

	clearDeck() {
		this.#device.clearPanel().catch((e) => {
			this.#logger.debug(`Clear deck failed: ${e}`)
		})
	}

	/**
	 * Trigger a redraw of this control, if it can be drawn
	 * @access protected
	 */
	#triggerRedraw = debounceFn(
		() => {
			/** @type {import('@blackmagic-controller/core').BlackmagicControllerSetButtonColorValue[]} */
			const colors = []

			const threshold = 100 // Use a lower than 50% threshold, to make it more sensitive

			for (const [id, image] of Object.entries(this.#pendingDraw)) {
				const color = colorToRgb(image.bgcolor)
				colors.push({
					keyId: id,
					red: color.r >= threshold,
					green: color.g >= threshold,
					blue: color.b >= threshold,
				})
			}

			if (colors.length === 0) return

			this.#pendingDraw = {}
			this.#device.setButtonColors(colors).catch((e) => {
				this.#logger.error(`write failed: ${e}`)
			})
		},
		{
			before: false,
			after: true,
			wait: 5,
			maxWait: 20,
		}
	)
	/**
	 * @type {Record<string, ImageResult>}
	 */
	#pendingDraw = {}

	/**
	 * Draw multiple buttons
	 * @param {import('../Handler.js').DrawButtonItem[]} renders
	 */
	drawMany(renders) {
		for (const { x, y, image } of renders) {
			const control = this.#device.CONTROLS.find(
				(control) => control.type === 'button' && control.row === y && control.column === x
			)
			if (!control) continue

			this.#pendingDraw[control.id] = image
		}

		this.#triggerRedraw()
	}

	/**
	 * Draw a button
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} image
	 * @returns {void}
	 */
	draw(x, y, image) {
		// Should never be called, implement just in case
		return this.drawMany([{ x, y, image }])
	}
}
