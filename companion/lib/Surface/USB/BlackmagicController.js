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
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,
	{
		id: 'tbarValueVariable',
		type: 'custom-variable',
		label: 'Variable to store T-bar value to',
		tooltip: 'This produces a value between 0 and 1. You can use an expression to convert it into a different range.',
	},
	{
		id: 'tbarLeds',
		type: 'textinput',
		label: 'T-bar LED pattern',
		isExpression: true,
		tooltip:
			'Set the pattern of LEDs on the T-bar. Use numbers -16 to 16, positive numbers light up from the bottom, negative from the top.',
	},
]

export class SurfaceUSBBlackmagicController extends EventEmitter {
	/**
	 * @type {import('winston').Logger}
	 * @access private
	 * @readonly
	 */
	#logger

	/**
	 * @type {import('../Controller.js').SurfaceExecuteExpressionFn}
	 * @access private
	 * @readonly
	 */
	#executeExpression

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

	#lastTbarValue = 0

	/**
	 * The variables referenced in the last draw of the tbar. Whenever one of these changes, a redraw should be performed
	 * @access protected
	 * @type {Set<string> | null}
	 */
	#lastTbarDrawReferencedVariables = null

	/**
	 * @param {import('../Controller.js').SurfaceExecuteExpressionFn} executeExpression
	 * @param {string} devicePath
	 * @param {import('@blackmagic-controller/node').BlackmagicController} blackmagicController
	 */
	constructor(executeExpression, devicePath, blackmagicController) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/BlackmagicController/${devicePath}`)
		this.#executeExpression = executeExpression

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
			this.#lastTbarValue = value

			this.#emitTbarValue()
		})

		// Kick off the tbar value
		this.#triggerRedrawTbar()
	}
	async #init() {
		const serialNumber = await this.#device.getSerialNumber()
		this.info.deviceId = `blackmagic:${serialNumber}`

		// Make sure the first clear happens properly
		await this.#device.clearPanel()
	}

	#emitTbarValue() {
		const tbarVariableName = this.config.tbarValueVariable
		if (tbarVariableName) {
			this.emit('setCustomVariable', tbarVariableName, this.#lastTbarValue)
		}
	}

	/**
	 * Open a framework macropad
	 * @param {string} devicePath
	 * @param {import('../Controller.js').LocalUSBDeviceOptions} options
	 * @returns {Promise<SurfaceUSBBlackmagicController>}
	 */
	static async create(devicePath, options) {
		const blackmagicController = await openBlackmagicController(devicePath)

		try {
			const self = new SurfaceUSBBlackmagicController(options.executeExpression, devicePath, blackmagicController)

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
		// This will be a no-op if the value hasn't changed
		this.#emitTbarValue()

		// TODO - make more granular:
		this.#triggerRedrawTbar()

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
	 * Propagate variable changes
	 * @param {Set<string>} allChangedVariables - variables with changes
	 * @access public
	 */
	onVariablesChanged(allChangedVariables) {
		if (this.#lastTbarDrawReferencedVariables) {
			for (const variable of allChangedVariables.values()) {
				if (this.#lastTbarDrawReferencedVariables.has(variable)) {
					this.#logger.silly('variable changed in tbar')
					this.#triggerRedrawTbar()
					return
				}
			}
		}
	}

	/**
	 * Trigger a redraw of the tbar, if it can be drawn
	 * @access protected
	 */
	#triggerRedrawTbar = debounceFn(
		() => {
			const tbarControl = this.#device.CONTROLS.find((control) => control.type === 'tbar' && control.id === 0)
			if (!tbarControl) {
				this.#logger.error(`T-bar control not found`)
				return
			}

			/** @type {any} */
			let expressionResult = 0

			const expressionText = this.config.tbarLeds
			try {
				const parseResult = this.#executeExpression(expressionText ?? '', this.info.deviceId, undefined)
				expressionResult = parseResult.value

				this.#lastTbarDrawReferencedVariables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
			} catch (e) {
				this.#logger.error(`T-bar expression parse error: ${e}`)

				this.#lastTbarDrawReferencedVariables = null
			}

			let ledValues = new Array(tbarControl.ledSegments).fill(false)
			const fillLedCount = Number(expressionResult)
			if (isNaN(fillLedCount)) {
				return // Future: allow patterns
			}

			if (fillLedCount > 0) {
				ledValues.fill(true, Math.max(ledValues.length - fillLedCount, 0))
			} else if (fillLedCount < 0) {
				ledValues.fill(true, 0, Math.min(-fillLedCount, ledValues.length))
			}

			this.#device.setTbarLeds(ledValues).catch((e) => {
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
