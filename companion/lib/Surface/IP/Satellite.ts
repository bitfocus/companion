/*
 * This file is part of the Companion project
 * Copyright (c) 2019 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
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
import LogController from '../../Log/Controller.js'
import { EventEmitter } from 'events'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import imageRs from '@julusian/image-rs'
import { parseColor, parseColorToNumber, transformButtonImage } from '../../Resources/Util.js'
import { convertXYToIndexForPanel, convertPanelIndexToXY } from '../Util.js'
import {
	BrightnessConfigField,
	LegacyRotationConfigField,
	LockConfigFields,
	OffsetConfigFields,
	RotationConfigField,
} from '../CommonConfigFields.js'
import debounceFn from 'debounce-fn'
import { VARIABLE_UNKNOWN_VALUE } from '../../Variables/Util.js'
import type { CompanionVariableValue } from '@companion-module/base'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { SurfaceExecuteExpressionFn, SurfacePanel, SurfacePanelEvents, SurfacePanelInfo } from '../Types.js'
import type { ImageResult, ImageResultStyle } from '../../Graphics/ImageResult.js'
import type { SatelliteSocketWrapper } from '../../Service/SatelliteApi.js'

export interface SatelliteDeviceInfo {
	deviceId: string
	productName: string
	path: string
	socket: SatelliteSocketWrapper
	gridSize: GridSize
	supportsBrightness: boolean
	streamBitmapSize: number | null
	streamColors: string | boolean
	streamText: boolean
	streamTextStyle: boolean
	transferVariables: SatelliteTransferableValue[]
}
export interface SatelliteTransferableValue {
	id: string
	type: 'input' | 'output'
	name: string
	description: string | undefined
}
interface SatelliteInputVariableInfo {
	id: string
	lastValue: CompanionVariableValue
}
interface SatelliteOutputVariableInfo {
	id: string
	lastReferencedVariables: Set<string> | null
	lastValue: any
	triggerUpdate?: () => void
}

function generateConfigFields(
	deviceInfo: SatelliteDeviceInfo,
	legacyRotation: boolean,
	inputVariables: Record<string, SatelliteInputVariableInfo>,
	outputVariables: Record<string, SatelliteOutputVariableInfo>
): CompanionSurfaceConfigField[] {
	const fields: CompanionSurfaceConfigField[] = [...OffsetConfigFields]
	if (deviceInfo.supportsBrightness) {
		fields.push(BrightnessConfigField)
	}
	fields.push(legacyRotation ? LegacyRotationConfigField : RotationConfigField, ...LockConfigFields)

	for (const variable of deviceInfo.transferVariables) {
		if (variable.type === 'input') {
			const id = `satellite_input_${variable.id}`
			fields.push({
				id,
				type: 'custom-variable',
				label: variable.name,
				tooltip: variable.description,
			})

			inputVariables[variable.id] = {
				id,
				lastValue: '',
			}
		} else if (variable.type === 'output') {
			const id = `satellite_output_${variable.id}`

			fields.push({
				id,
				type: 'textinput',
				label: variable.name,
				tooltip: variable.description,
				isExpression: true,
			})

			outputVariables[variable.id] = {
				id,
				lastReferencedVariables: null,
				lastValue: undefined,
			}
		}
	}

	return fields
}

export class SurfaceIPSatellite extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger = LogController.createLogger('Surface/IP/Satellite')

	readonly #executeExpression: SurfaceExecuteExpressionFn
	readonly #writeQueue: ImageWriteQueue<number, [import('../../Graphics/ImageResult.js').ImageResult]>

	#config: Record<string, any>

	/**
	 * Dimension of bitmaps to send to the satellite device.
	 */
	readonly #streamBitmapSize: number | null
	/**
	 * Whether to stream button colors to the satellite device and which format
	 * can be false, true or 'hex' for hex format, 'rgb' for css rgb format.
	 */
	readonly #streamColors: string | boolean = false
	/**
	 * Whether to stream button text to the satellite device
	 */
	readonly #streamText: boolean = false
	/**
	 * Whether to stream button text style to the satellite device
	 */
	readonly #streamTextStyle: boolean = false

	readonly #inputVariables: Record<string, SatelliteInputVariableInfo> = {}
	readonly #outputVariables: Record<string, SatelliteOutputVariableInfo> = {}

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize
	readonly deviceId: string
	readonly socket: SatelliteSocketWrapper

	constructor(deviceInfo: SatelliteDeviceInfo, executeExpression: SurfaceExecuteExpressionFn) {
		super()

		this.#executeExpression = executeExpression

		this.gridSize = deviceInfo.gridSize

		this.deviceId = deviceInfo.deviceId

		this.socket = deviceInfo.socket

		this.#streamBitmapSize = deviceInfo.streamBitmapSize
		this.#streamColors = deviceInfo.streamColors
		this.#streamText = deviceInfo.streamText
		this.#streamTextStyle = deviceInfo.streamTextStyle

		this.info = {
			type: deviceInfo.productName,
			devicePath: deviceInfo.path,
			configFields: generateConfigFields(
				deviceInfo,
				!!this.#streamBitmapSize,
				this.#inputVariables,
				this.#outputVariables
			),
			deviceId: deviceInfo.path,
			location: deviceInfo.socket.remoteAddress,
		}

		this.#logger.info(`Adding Satellite device "${this.deviceId}"`)

		this.#config = {
			rotation: 0,
			brightness: 100,
		}

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (key, render) => {
			const targetSize = this.#streamBitmapSize
			if (!targetSize) return

			try {
				const newbuffer = await transformButtonImage(
					render,
					this.#config.rotation,
					targetSize,
					targetSize,
					imageRs.PixelFormat.Rgb
				)

				this.#sendDraw(key, newbuffer, render.style)
			} catch (e: any) {
				this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		})

		// Send all variables immediately
		for (const [name, outputVariable] of Object.entries(this.#outputVariables)) {
			this.#triggerOutputVariable(name, outputVariable)
		}
	}

	quit(): void {}

	/**
	 * Draw a button
	 */
	#sendDraw(key: number, buffer: Buffer | undefined, style: ImageResultStyle | undefined): void {
		if (this.socket !== undefined) {
			let params = ``
			if (this.#streamColors) {
				let bgcolor = 'rgb(0,0,0)'
				let fgcolor = 'rgb(0,0,0)'
				if (style && typeof style !== 'string' && style.color !== undefined && style.bgcolor !== undefined) {
					bgcolor = parseColor(style.bgcolor).replaceAll(' ', '')
					fgcolor = parseColor(style.color).replaceAll(' ', '')
				}
				if (this.#streamColors !== 'rgb') {
					bgcolor = '#' + parseColorToNumber(bgcolor).toString(16).padStart(6, '0')
					fgcolor = '#' + parseColorToNumber(fgcolor).toString(16).padStart(6, '0')
				}

				params += ` COLOR=${bgcolor} TEXTCOLOR=${fgcolor}`
			}
			if (this.#streamBitmapSize) {
				if (buffer === undefined || buffer.length == 0) {
					this.#logger.warn('buffer has invalid size')
				} else {
					params += ` BITMAP=${buffer.toString('base64')}`
				}
			}
			if (this.#streamText) {
				const text = (typeof style !== 'string' && style?.text) || ''
				params += ` TEXT=${Buffer.from(text).toString('base64')}`
			}
			if (this.#streamTextStyle) {
				params += ` FONT_SIZE=${style && typeof style !== 'string' ? style.size : 'auto'}`
			}

			let type = 'BUTTON'
			if (style === 'pageup') {
				type = 'PAGEUP'
			} else if (style === 'pagedown') {
				type = 'PAGEDOWN'
			} else if (style === 'pagenum') {
				type = 'PAGENUM'
			}

			params += ` PRESSED=${typeof style !== 'string' && style?.pushed ? 'true' : 'false'}`

			this.socket.write(`KEY-STATE DEVICEID=${this.deviceId} KEY=${key} TYPE=${type} ${params}\n`)
		}
	}

	/**
	 * parses a received key parameter
	 * @param key either as key number in legacy format starting at 0 or in row/column format starting at 0/0 top left
	 * @returns local key position in [x,y] format or null if input is not valid
	 */
	parseKeyParam(key: string): [x: number, y: number] | null {
		const keynum = Number(key)
		const keyParse = key.match(/^\+?(\d+)\/\+?(\d+)$/)

		if (
			Array.isArray(keyParse) &&
			Number(keyParse[1]) < this.gridSize.rows &&
			Number(keyParse[2]) < this.gridSize.columns
		) {
			return [Number(keyParse[2]), Number(keyParse[1])]
		} else if (!isNaN(keynum) && keynum < this.gridSize.columns * this.gridSize.rows && keynum >= 0) {
			return convertPanelIndexToXY(Number(key), this.gridSize)
		} else {
			return null
		}
	}

	/**
	 * Draw a button
	 */
	draw(x: number, y: number, render: ImageResult): void {
		const key = convertXYToIndexForPanel(x, y, this.gridSize)
		if (key === null) return

		if (this.#streamBitmapSize) {
			// Images need scaling
			this.#writeQueue.queue(key, render)
		} else {
			this.#sendDraw(key, undefined, render.style)
		}
	}

	/**
	 * Produce a click event
	 */
	doButton(column: number, row: number, state: boolean): void {
		this.emit('click', column, row, state)
	}

	/**
	 * Produce a rotation event
	 */
	doRotate(column: number, row: number, direction: boolean): void {
		this.emit('rotate', column, row, direction)
	}

	/**
	 * Set the value of a variable from this surface
	 */
	setVariableValue(variableName: string, variableValue: CompanionVariableValue): void {
		const inputVariableInfo = this.#inputVariables[variableName]
		if (!inputVariableInfo) return // Not known

		inputVariableInfo.lastValue = variableValue

		const targetCustomVariable = this.#config[inputVariableInfo.id]
		if (!targetCustomVariable) return // Not configured

		this.emit('setCustomVariable', targetCustomVariable, variableValue)
	}

	clearDeck(): void {
		this.#logger.silly('elgato.prototype.clearDeck()')
		if (this.socket !== undefined) {
			this.socket.write(`KEYS-CLEAR DEVICEID=${this.deviceId}\n`)
		} else {
			this.#logger.debug('trying to emit to nonexistent socket: ', this.deviceId)
		}
	}

	/**
	 * Propagate variable changes
	 */
	onVariablesChanged(allChangedVariables: Set<string>): void {
		for (const [name, outputVariable] of Object.entries(this.#outputVariables)) {
			if (!outputVariable.lastReferencedVariables) continue

			for (const variable of allChangedVariables.values()) {
				if (!outputVariable.lastReferencedVariables.has(variable)) continue

				// There is a change, recalculate and send the value

				this.#triggerOutputVariable(name, outputVariable)
				break
			}
		}
	}

	#triggerOutputVariable(name: string, outputVariable: SatelliteOutputVariableInfo): void {
		if (!outputVariable.triggerUpdate)
			outputVariable.triggerUpdate = debounceFn(
				() => {
					let expressionResult: CompanionVariableValue | undefined = VARIABLE_UNKNOWN_VALUE

					const expressionText = this.#config[outputVariable.id]
					try {
						const parseResult = this.#executeExpression(expressionText ?? '', this.info.deviceId, undefined)
						expressionResult = parseResult.value

						outputVariable.lastReferencedVariables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
					} catch (e) {
						this.#logger.error(`expression parse error: ${e}`)

						outputVariable.lastReferencedVariables = null
					}

					// Only send if the value has changed
					if (outputVariable.lastValue === expressionResult) return
					outputVariable.lastValue = expressionResult

					if (this.socket !== undefined) {
						const base64Value = Buffer.from(expressionResult?.toString() ?? '').toString('base64')
						this.socket.write(`VARIABLE-VALUE DEVICEID=${this.deviceId} VARIABLE="${name}" VALUE="${base64Value}"\n`)
					} else {
						this.#logger.debug('trying to emit to nonexistent socket: ', this.deviceId)
					}
				},
				{
					before: false,
					after: true,
					wait: 5,
					maxWait: 20,
				}
			)

		outputVariable.triggerUpdate()
	}

	/**
	 * Process the information from the GUI and what is saved in database
	 * @returns false when nothing happens
	 */
	setConfig(config: Record<string, any>, force = false): void {
		if ((force || this.#config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#setBrightness(config.brightness)
		}

		// Check if the variable name of the input variable has changed
		for (const inputVariable of Object.values(this.#inputVariables)) {
			if (config[inputVariable.id] && (force || this.#config[inputVariable.id] !== config[inputVariable.id])) {
				this.emit('setCustomVariable', config[inputVariable.id], inputVariable.lastValue)
			}
		}

		this.#config = config
	}

	/**
	 * Set the brightness
	 * @param value 0-100
	 */
	#setBrightness(value: number): void {
		this.#logger.silly('brightness: ' + value)
		if (this.socket !== undefined) {
			this.socket.write(`BRIGHTNESS DEVICEID=${this.deviceId} VALUE=${value}\n`)
		}
	}
}
