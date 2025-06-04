/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: Julian Waller <me@julusian.co.uk>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */

import { EventEmitter } from 'events'
import LogController, { Logger } from '../../Log/Controller.js'
import { colorToRgb } from './Util.js'
import {
	BlackmagicController,
	openBlackmagicController,
	BlackmagicControllerSetButtonSomeValue,
	BlackmagicControllerButtonControlDefinition,
} from '@blackmagic-controller/node'
import debounceFn from 'debounce-fn'
import { LockConfigFields, OffsetConfigFields, RotationConfigField } from '../CommonConfigFields.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type {
	DrawButtonItem,
	LocalUSBDeviceOptions,
	SurfaceExecuteExpressionFn,
	SurfacePanel,
	SurfacePanelEvents,
	SurfacePanelInfo,
} from '../Types.js'
import type { CompanionVariableValue } from '@companion-module/base'
import { assertNever } from '@companion-app/shared/Util.js'

const baseConfigFields: CompanionSurfaceConfigField[] = [
	...OffsetConfigFields,
	RotationConfigField,
	...LockConfigFields,
]
const tbarConfigFields: CompanionSurfaceConfigField[] = [
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
const jogConfigFields: CompanionSurfaceConfigField[] = [
	{
		id: 'jogValueVariable',
		type: 'custom-variable',
		label: 'Variable to store Jog value to',
		tooltip: 'This produces a value between 0 and 1. You can use an expression to convert it into a different range.',
	},
]

export class SurfaceUSBBlackmagicController extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	readonly #executeExpression: SurfaceExecuteExpressionFn

	readonly #device: BlackmagicController

	config: Record<string, any> = {}

	#lastTbarValue: number = 0
	#lastJogValue: number = 0

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	/**
	 * The variables referenced in the last draw of the tbar. Whenever one of these changes, a redraw should be performed
	 */
	#lastTbarDrawReferencedVariables: ReadonlySet<string> | null = null

	constructor(
		executeExpression: SurfaceExecuteExpressionFn,
		devicePath: string,
		blackmagicController: BlackmagicController
	) {
		super()

		this.#logger = LogController.createLogger(`Surface/USB/BlackmagicController/${devicePath}`)
		this.#executeExpression = executeExpression

		this.config = {}

		this.#logger.debug(`Adding blackmagic controller USB device: ${devicePath}`)

		this.#device = blackmagicController

		const configFields = [...baseConfigFields]
		if (this.#device.CONTROLS.some((control) => control.type === 'tbar')) configFields.push(...tbarConfigFields)
		if (this.#device.CONTROLS.some((control) => control.type === 'jog')) configFields.push(...jogConfigFields)

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

		this.#device.on('jog', (_control, value) => {
			this.#logger.silly(`Jog value has changed`, value)
			this.#lastJogValue = value

			this.#emitJogValue()
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

	#emitJogValue() {
		const jogVariableName = this.config.jogValueVariable
		if (jogVariableName) {
			this.emit('setCustomVariable', jogVariableName, this.#lastJogValue)
		}
	}

	/**
	 * Open a blackmagic controller
	 */
	static async create(devicePath: string, options: LocalUSBDeviceOptions): Promise<SurfaceUSBBlackmagicController> {
		const blackmagicController = await openBlackmagicController(devicePath)

		try {
			const self = new SurfaceUSBBlackmagicController(options.executeExpression, devicePath, blackmagicController)

			let errorDuringInit: any = null
			const tmpErrorHandler = (error: any) => {
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
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, _force = false) {
		// This will be a no-op if the value hasn't changed
		this.#emitTbarValue()
		this.#emitJogValue()

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
	 */
	onVariablesChanged(allChangedVariables: Set<string>) {
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

			let expressionResult: CompanionVariableValue | undefined = 0

			const expressionText = this.config.tbarLeds
			const parseResult = this.#executeExpression(expressionText ?? '', this.info.deviceId, undefined)
			if (parseResult.ok) {
				expressionResult = parseResult.value
			} else {
				this.#logger.error(`T-bar expression parse error: ${parseResult.error}`)
			}
			this.#lastTbarDrawReferencedVariables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null

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
			const colors: BlackmagicControllerSetButtonSomeValue[] = []

			const threshold = 100 // Use a lower than 50% threshold, to make it more sensitive

			for (const [id, { bgcolor, control }] of Object.entries(this.#pendingDraw)) {
				const color = colorToRgb(bgcolor)
				const red = color.r >= threshold
				const green = color.g >= threshold
				const blue = color.b >= threshold

				switch (control.feedbackType) {
					case 'rgb':
						colors.push({
							keyId: id,
							type: 'rgb',
							red: color.r >= threshold,
							green: color.g >= threshold,
							blue: color.b >= threshold,
						})
						break
					case 'on-off':
						colors.push({
							keyId: id,
							type: 'on-off',
							on: red || green || blue,
						})
						break
					case 'none':
						// no-op
						break
					default:
						assertNever(control.feedbackType)
						break
				}
			}

			if (colors.length === 0) return

			this.#pendingDraw = {}
			this.#device.setButtonStates(colors).catch((e) => {
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
	#pendingDraw: Record<string, { bgcolor: number; control: BlackmagicControllerButtonControlDefinition }> = {}

	/**
	 * Draw multiple buttons
	 */
	drawMany(renders: DrawButtonItem[]) {
		for (const { x, y, defaultRender } of renders) {
			const control = this.#device.CONTROLS.find(
				(control): control is BlackmagicControllerButtonControlDefinition =>
					control.type === 'button' && control.row === y && control.column === x
			)
			if (!control) continue

			this.#pendingDraw[control.id] = { bgcolor: defaultRender.bgcolor, control }
		}

		this.#triggerRedraw()
	}

	/**
	 * Draw a button
	 */
	draw(item: DrawButtonItem): void {
		// Should never be called, implement just in case
		return this.drawMany([item])
	}
}
