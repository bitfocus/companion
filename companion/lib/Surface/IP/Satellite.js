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
import ImageWriteQueue from '../../Resources/ImageWriteQueue.js'
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

/**
 * @typedef {{
 *   deviceId: string
 *   productName: string
 *   path: string
 *   socket: import('net').Socket
 *   gridSize: import('../Util.js').GridSize
 *   streamBitmapSize: number | null
 *   streamColors: string | boolean
 *   streamText: boolean
 *   streamTextStyle: boolean
 *   transferVariables: SatelliteTransferableValue[]
 * }} SatelliteDeviceInfo
 * @typedef {{
 *   id: string
 *   type: 'input' | 'output'
 * 	 name: string
 *   description: string | undefined
 * }} SatelliteTransferableValue
 * @typedef {{
 * 	 id: string
 *   lastValue: import('@companion-module/base').CompanionVariableValue
 * }} SatelliteInputVariableInfo
 * @typedef {{
 * 	 id: string
 *   lastReferencedVariables: Set<string> | null
 *   triggerUpdate?: () => void
 * }} SatelliteOutputVariableInfo
 */

/**
 * @param {SatelliteDeviceInfo} deviceInfo
 * @param {boolean} legacyRotation
 * @param {Record<string, SatelliteInputVariableInfo>} inputVariables
 * @param {Record<string, SatelliteOutputVariableInfo>} outputVariables
 * @return {import('@companion-app/shared/Model/Surfaces.js').CompanionSurfaceConfigField[]}
 */
function generateConfigFields(deviceInfo, legacyRotation, inputVariables, outputVariables) {
	/** @type {import('@companion-app/shared/Model/Surfaces.js').CompanionSurfaceConfigField[]} */
	const fields = [
		...OffsetConfigFields,
		BrightnessConfigField,
		legacyRotation ? LegacyRotationConfigField : RotationConfigField,
		...LockConfigFields,
	]

	for (const variable of deviceInfo.transferVariables) {
		if (variable.type === 'input') {
			const id = `satellite_input_${variable.id}`
			fields.push({
				id,
				type: 'textinput',
				label: variable.name,
				tooltip: variable.description,
				isExpression: true,
			})

			inputVariables[variable.id] = {
				id,
				lastValue: '',
			}
		} else if (variable.type === 'output') {
			const id = `satellite_output_${variable.id}`
			fields.push({
				id,
				type: 'custom-variable',
				label: variable.name,
				tooltip: variable.description,
			})

			outputVariables[variable.id] = {
				id,
				lastReferencedVariables: null,
			}
		}
	}

	return fields
}

class SurfaceIPSatellite extends EventEmitter {
	#logger = LogController.createLogger('Surface/IP/Satellite')

	/**
	 * @type {import('../Controller.js').SurfaceExecuteExpressionFn}
	 * @access private
	 * @readonly
	 */
	#executeExpression

	/**
	 * @type {ImageWriteQueue}
	 * @access private
	 */
	#writeQueue

	/**
	 * @type {Record<string, any>}
	 * @access private
	 */
	#config

	/**
	 * Dimension of bitmaps to send to the satellite device.
	 * @type {number | null}
	 * @access private
	 */
	#streamBitmapSize
	/**
	 * Whether to stream button colors to the satellite device and which format
	 * can be false, true or 'hex' for hex format, 'rgb' for css rgb format.
	 * @type {string | boolean}
	 * @access private
	 */
	#streamColors = false
	/**
	 * Whether to stream button text to the satellite device
	 * @type {boolean}
	 * @access private
	 */
	#streamText = false
	/**
	 * Whether to stream button text style to the satellite device
	 * @type {boolean}
	 * @access private
	 */
	#streamTextStyle = false

	/**
	 * @type {Record<string, SatelliteInputVariableInfo>}
	 * @access private
	 * @readonly
	 */
	#inputVariables = {}
	/**
	 * @type {Record<string, SatelliteOutputVariableInfo>}
	 * @access private
	 * @readonly
	 */
	#outputVariables = {}

	/**
	 * @param {SatelliteDeviceInfo} deviceInfo
	 * @param {import('../Controller.js').SurfaceExecuteExpressionFn} executeExpression
	 */
	constructor(deviceInfo, executeExpression) {
		super()

		this.#executeExpression = executeExpression

		this.gridSize = deviceInfo.gridSize

		this.deviceId = deviceInfo.deviceId

		this.socket = deviceInfo.socket

		this.#streamBitmapSize = deviceInfo.streamBitmapSize
		this.#streamColors = deviceInfo.streamColors
		this.#streamText = deviceInfo.streamText
		this.#streamTextStyle = deviceInfo.streamTextStyle

		/** @type {import('../Handler.js').SurfacePanelInfo} */
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

		this.#writeQueue = new ImageWriteQueue(
			this.#logger,
			async (/** @type {number} */ key, /** @type {import('../../Graphics/ImageResult.js').ImageResult} */ render) => {
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
				} catch (/** @type {any} */ e) {
					this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
					this.emit('remove')
					return
				}
			}
		)
	}

	quit() {}

	/**
	 * Draw a button
	 * @param {number} key
	 * @param {Buffer | undefined} buffer
	 * @param {*} style
	 * @returns {void}
	 */
	#sendDraw(key, buffer, style) {
		if (this.socket !== undefined) {
			let params = ``
			if (this.#streamColors) {
				let bgcolor = 'rgb(0,0,0)'
				let fgcolor = 'rgb(0,0,0)'
				if (style && style.color !== undefined && style.bgcolor !== undefined) {
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
				const text = style?.text || ''
				params += ` TEXT=${Buffer.from(text).toString('base64')}`
			}
			if (this.#streamTextStyle) {
				params += ` FONT_SIZE=${style ? style.size : 'auto'}`
			}

			let type = 'BUTTON'
			if (style === 'pageup') {
				type = 'PAGEUP'
			} else if (style === 'pagedown') {
				type = 'PAGEDOWN'
			} else if (style === 'pagenum') {
				type = 'PAGENUM'
			}

			params += ` PRESSED=${style?.pushed ? 'true' : 'false'}`

			this.socket.write(`KEY-STATE DEVICEID=${this.deviceId} KEY=${key} TYPE=${type} ${params}\n`)
		}
	}

	/**
	 * parses a received key parameter
	 * @param {string} key either as key number in legacy format starting at 0 or in row/column format starting at 0/0 top left
	 * @returns {[x: number, y: number] | null} local key position in [x,y] format or null if input is not valid
	 */
	parseKeyParam(key) {
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
	 * @param {number} x
	 * @param {number} y
	 * @param {import('../../Graphics/ImageResult.js').ImageResult} render
	 * @returns {void}
	 */
	draw(x, y, render) {
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
	 * @param {number} column
	 * @param {number} row
	 * @param {boolean} state
	 */
	doButton(column, row, state) {
		this.emit('click', column, row, state)
	}

	/**
	 * Produce a rotation event
	 * @param {number} column
	 * @param {number} row
	 * @param {boolean} direction
	 */
	doRotate(column, row, direction) {
		this.emit('rotate', column, row, direction)
	}

	/**
	 * Set the value of a variable from this surface
	 * @param {string} variableName
	 * @param {import('@companion-module/base').CompanionVariableValue} variableValue
	 */
	setVariableValue(variableName, variableValue) {
		const inputVariableInfo = this.#inputVariables[variableName]
		if (!inputVariableInfo) return // Not known

		inputVariableInfo.lastValue = variableValue

		const targetCustomVariable = this.#config[inputVariableInfo.id]
		if (!targetCustomVariable) return // Not configured

		this.emit('setCustomVariable', targetCustomVariable, variableValue)
	}

	clearDeck() {
		this.#logger.silly('elgato.prototype.clearDeck()')
		if (this.socket !== undefined) {
			this.socket.write(`KEYS-CLEAR DEVICEID=${this.deviceId}\n`)
		} else {
			this.#logger.debug('trying to emit to nonexistant socket: ', this.deviceId)
		}
	}

	/**
	 * Propagate variable changes
	 * @param {Set<string>} allChangedVariables - variables with changes
	 * @access public
	 */
	onVariablesChanged(allChangedVariables) {
		for (const [name, outputVariable] of Object.entries(this.#outputVariables)) {
			if (!outputVariable.lastReferencedVariables) continue

			for (const variable of allChangedVariables.values()) {
				if (!outputVariable.lastReferencedVariables.has(variable)) continue

				// There is a change, recalcuate and send the value

				this.#triggerOutputVariable(name, outputVariable)
				break
			}
		}
	}

	/**
	 *
	 * @param {string} name
	 * @param {SatelliteOutputVariableInfo} outputVariable
	 */
	#triggerOutputVariable(name, outputVariable) {
		if (!outputVariable.triggerUpdate)
			outputVariable.triggerUpdate = debounceFn(
				() => {
					/** @type {any} */
					let expressionResult = VARIABLE_UNKNOWN_VALUE

					const expressionText = this.#config[outputVariable.id]
					try {
						const parseResult = this.#executeExpression(expressionText ?? '', this.info.deviceId, undefined)
						expressionResult = parseResult.value

						outputVariable.lastReferencedVariables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null
					} catch (e) {
						this.#logger.error(`expression parse error: ${e}`)

						outputVariable.lastReferencedVariables = null
					}

					if (this.socket !== undefined) {
						const base64Value = Buffer.from(expressionResult.toString()).toString('base64')
						this.socket.write(`VARIABLE-VALUE DEVICEID=${this.deviceId} VARIABLE="${name}" VALUE="${base64Value}"\n`)
					} else {
						this.#logger.debug('trying to emit to nonexistant socket: ', this.deviceId)
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
	 * @param {Record<string, any>} config
	 * @param {boolean=} force
	 * @returns false when nothing happens
	 */
	setConfig(config, force) {
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
	 * @param {number} value 0-100
	 */
	#setBrightness(value) {
		this.#logger.silly('brightness: ' + value)
		if (this.socket !== undefined) {
			this.socket.write(`BRIGHTNESS DEVICEID=${this.deviceId} VALUE=${value}\n`)
		}
	}
}

export default SurfaceIPSatellite
