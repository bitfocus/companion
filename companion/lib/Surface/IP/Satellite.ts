/*
 * This file is part of the Companion project
 * Copyright (c) 2019 Bitfocus AS
 * Authors: Håkon Nessjøen <haakon@bitfocus.io>, William Viker <william@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 */
import LogController from '../../Log/Controller.js'
import { EventEmitter } from 'events'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import { parseColorToNumber } from '../../Resources/Util.js'
import { parseColor } from '@companion-app/shared/Graphics/Util.js'
import { convertXYToIndexForPanel, convertPanelIndexToXY } from '../Util.js'
import {
	BrightnessConfigField,
	LegacyRotationConfigField,
	LockConfigFields,
	OffsetConfigFields,
	RotationConfigField,
} from '../CommonConfigFields.js'
import debounceFn from 'debounce-fn'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import { GraphicsRenderer } from '../../Graphics/Renderer.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import { stringifyVariableValue, type VariableValue } from '@companion-app/shared/Model/Variables.js'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type {
	DrawButtonItem,
	SurfaceExecuteExpressionFn,
	SurfacePanel,
	SurfacePanelEvents,
	SurfacePanelInfo,
} from '../Types.js'
import type { SatelliteMessageArgs, SatelliteSocketWrapper } from '../../Service/Satellite/SatelliteApi.js'
import type {
	SatelliteControlStylePreset,
	SatelliteSurfaceLayout,
} from '../../Service/Satellite/SatelliteSurfaceManifestSchema.js'
import type { ReadonlyDeep } from 'type-fest'

export interface SatelliteDeviceInfo {
	deviceId: string
	productName: string
	socket: SatelliteSocketWrapper
	gridSize: GridSize
	supportsBrightness: boolean
	transferVariables: SatelliteTransferableValue[]
	supportsLockedState: boolean

	surfaceManifestFromClient: boolean
	surfaceManifest: SatelliteSurfaceLayout
}
export interface SatelliteTransferableValue {
	id: string
	type: 'input' | 'output'
	name: string
	description: string | undefined
}
interface SatelliteInputVariableInfo {
	id: string
	lastValue: VariableValue
}
interface SatelliteOutputVariableInfo {
	id: string
	lastReferencedVariables: ReadonlySet<string> | null
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

function formatSurfaceXy(x: number, y: number): string {
	return `${y}/${x}`
}

interface ResolvedControlDefinition {
	// The id as reported by the client
	id: string
	// The row as reported by the client
	row: number
	// The column as reported by the client
	column: number
	// The styles requested by the client
	style: SatelliteControlStylePreset
}

function resolveControlDefinitions(
	surfaceManifest: ReadonlyDeep<SatelliteSurfaceLayout>
): ReadonlyMap<string, ResolvedControlDefinition[]> {
	const controlStyles = new Map<string, ResolvedControlDefinition[]>()

	for (const [id, spec] of Object.entries(surfaceManifest.controls)) {
		const xy = formatSurfaceXy(spec.column, spec.row)
		let arr = controlStyles.get(xy)
		if (!arr) {
			arr = []
			controlStyles.set(xy, arr)
		}

		let style = surfaceManifest.stylePresets.default
		if (spec.stylePreset) {
			style = surfaceManifest.stylePresets[spec.stylePreset] || style
		}

		arr.push({
			id,
			row: spec.row,
			column: spec.column,
			style,
		})
	}

	return controlStyles
}

export class SurfaceIPSatellite extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger = LogController.createLogger('Surface/IP/Satellite')

	readonly #executeExpression: SurfaceExecuteExpressionFn
	readonly #writeQueue: ImageWriteQueue<string, [ResolvedControlDefinition, DrawButtonItem]>

	#config: Record<string, any>

	readonly surfaceManifestFromClient: boolean
	readonly #surfaceManifest: ReadonlyDeep<SatelliteSurfaceLayout>
	readonly #controlDefinitions: ReadonlyMap<string, ResolvedControlDefinition[]>
	readonly #supportsLockedState: boolean

	readonly #inputVariables: Record<string, SatelliteInputVariableInfo> = {}
	readonly #outputVariables: Record<string, SatelliteOutputVariableInfo> = {}

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize
	readonly deviceId: string
	readonly socket: SatelliteSocketWrapper

	// Cache for generated lock images by dimension
	#lockImage: ImageResult | null = null

	constructor(deviceInfo: SatelliteDeviceInfo, executeExpression: SurfaceExecuteExpressionFn) {
		super()

		this.#executeExpression = executeExpression

		this.gridSize = deviceInfo.gridSize

		this.deviceId = deviceInfo.deviceId

		this.socket = deviceInfo.socket

		this.surfaceManifestFromClient = deviceInfo.surfaceManifestFromClient
		this.#surfaceManifest = deviceInfo.surfaceManifest
		this.#controlDefinitions = resolveControlDefinitions(deviceInfo.surfaceManifest)
		this.#supportsLockedState = deviceInfo.supportsLockedState

		const anyControlHasBitmap = !!this.#controlDefinitions
			.values()
			.find((controls) => !!controls.find((control) => !!control.style.bitmap))

		this.info = {
			description: deviceInfo.productName,
			configFields: generateConfigFields(deviceInfo, anyControlHasBitmap, this.#inputVariables, this.#outputVariables),
			surfaceId: deviceInfo.deviceId,
			location: deviceInfo.socket.remoteAddress ?? null,
		}

		this.#logger.info(`Adding Satellite device "${this.deviceId}"`)

		this.#config = {
			rotation: 0,
			brightness: 100,
		}

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (_id, controlDefinition, drawItem) => {
			try {
				await this.#sendDraw(controlDefinition, drawItem)
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

	setLocked(locked: boolean, characterCount: number): void {
		if (this.#supportsLockedState) {
			this.#logger.silly(`locked: ${locked} - ${characterCount}`)
			if (this.socket !== undefined) {
				this.socket.sendMessage('LOCKED-STATE', null, this.deviceId, {
					LOCKED: locked,
					CHARACTER_COUNT: characterCount,
				})
			}
		} else {
			// Clear the deck to blank anything we won't be drawing to
			this.clearDeck()

			if (!locked) return

			// Iterate through all controls and draw lock icons/text
			for (const definitions of this.#controlDefinitions.values()) {
				for (const definition of definitions) {
					// Queue the draw
					this.#writeQueue.queue(definition.id, definition, {
						x: definition.column,
						y: definition.row,
						defaultRender: this.#getLockImage(),
					})
				}
			}
		}
	}

	/**
	 * Get or generate a lock icon image for a given size
	 */
	#getLockImage(): ImageResult {
		if (!this.#lockImage) this.#lockImage = GraphicsRenderer.drawLockIcon()

		return this.#lockImage
	}

	quit(): void {}

	/**
	 * Draw a button
	 */
	async #sendDraw(controlDefinition: ResolvedControlDefinition, drawItem: DrawButtonItem): Promise<void> {
		if (!this.socket) return

		const params: SatelliteMessageArgs = {}

		// Include the global identifier depending on the mode
		if (!this.surfaceManifestFromClient) {
			const keyIndex = convertXYToIndexForPanel(controlDefinition.column, controlDefinition.row, this.gridSize)
			if (keyIndex === null) return

			params['KEY'] = keyIndex
		} else {
			params['CONTROLID'] = controlDefinition.id
		}

		const style = drawItem.defaultRender.style

		if (controlDefinition.style.bitmap) {
			const buffer = await drawItem.defaultRender.drawNative(
				controlDefinition.style.bitmap.w,
				controlDefinition.style.bitmap.h,
				this.#config.rotation,
				'rgb'
			)

			if (buffer === undefined || buffer.length == 0) {
				this.#logger.warn('buffer has invalid size')
			} else {
				params['BITMAP'] = Buffer.from(buffer).toString('base64')
			}
		}

		if (!this.socket) return

		if (controlDefinition.style.colors) {
			let bgcolor = style?.color ? parseColor(style.color.color).replaceAll(' ', '') : 'rgb(0,0,0)'
			let fgcolor = style?.text ? parseColor(style.text.color).replaceAll(' ', '') : 'rgb(0,0,0)'

			if (controlDefinition.style.colors !== 'rgb') {
				bgcolor = '#' + parseColorToNumber(bgcolor).toString(16).padStart(6, '0')
				fgcolor = '#' + parseColorToNumber(fgcolor).toString(16).padStart(6, '0')
			}

			params['COLOR'] = bgcolor
			params['TEXTCOLOR'] = fgcolor
		}

		if (controlDefinition.style.text) {
			const text = style?.text?.text || ''
			params['TEXT'] = Buffer.from(text).toString('base64')
		}
		if (controlDefinition.style.textStyle) {
			params['FONT_SIZE'] = style?.text?.size ?? 'auto'
		}

		let type = 'BUTTON'
		if (style?.type === 'pageup') {
			type = 'PAGEUP'
		} else if (style?.type === 'pagedown') {
			type = 'PAGEDOWN'
		} else if (style?.type === 'pagenum') {
			type = 'PAGENUM'
		}

		params['PRESSED'] = typeof style !== 'string' && !!style?.state?.pushed
		params['TYPE'] = type

		if (!this.socket) return

		this.socket.sendMessage('KEY-STATE', null, this.deviceId, params)
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
	draw(item: DrawButtonItem): void {
		const definitions = this.#controlDefinitions.get(formatSurfaceXy(item.x, item.y))
		if (!definitions) return

		for (const definition of definitions) {
			this.#writeQueue.queue(definition.id, definition, item)
		}
	}

	/**
	 * Produce a click event
	 */
	doButton(column: number, row: number, state: boolean): void {
		this.emit('click', column, row, state)
	}
	doButtonFromId(controlId: string, state: boolean): boolean {
		const controlManifest = this.#surfaceManifest.controls[controlId]
		if (!controlManifest) return false

		this.emit('click', controlManifest.column, controlManifest.row, state)
		return true
	}

	doPincodeKey(pincodeKey: number): void {
		this.emit('pincodeKey', pincodeKey)
	}

	/**
	 * Produce a rotation event
	 */
	doRotate(column: number, row: number, direction: boolean): void {
		this.emit('rotate', column, row, direction)
	}
	doRotateFromId(controlId: string, direction: boolean): boolean {
		const controlManifest = this.#surfaceManifest.controls[controlId]
		if (!controlManifest) return false

		this.emit('rotate', controlManifest.column, controlManifest.row, direction)
		return true
	}

	/**
	 * Set the value of a variable from this surface
	 */
	setVariableValue(variableName: string, variableValue: VariableValue): void {
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
			this.socket.sendMessage('KEYS-CLEAR', null, this.deviceId, {})
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

			if (outputVariable.lastReferencedVariables.isDisjointFrom(allChangedVariables)) continue

			// There is a change, recalculate and send the value
			this.#triggerOutputVariable(name, outputVariable)
		}
	}

	#triggerOutputVariable(name: string, outputVariable: SatelliteOutputVariableInfo): void {
		if (!outputVariable.triggerUpdate)
			outputVariable.triggerUpdate = debounceFn(
				() => {
					let expressionResult: VariableValue | undefined = VARIABLE_UNKNOWN_VALUE

					const expressionText = this.#config[outputVariable.id]
					const parseResult = this.#executeExpression(expressionText ?? '', this.info.surfaceId, undefined)
					if (parseResult.ok) {
						expressionResult = parseResult.value
					} else {
						this.#logger.error(`expression parse error: ${parseResult.error}`)
						expressionResult = VARIABLE_UNKNOWN_VALUE
					}

					outputVariable.lastReferencedVariables = parseResult.variableIds.size > 0 ? parseResult.variableIds : null

					// Only send if the value has changed
					if (outputVariable.lastValue === expressionResult) return
					outputVariable.lastValue = expressionResult

					if (this.socket !== undefined) {
						const base64Value = Buffer.from(stringifyVariableValue(expressionResult) ?? '').toString('base64')
						this.socket.sendMessage('VARIABLE-VALUE', null, this.deviceId, {
							VARIABLE: name,
							VALUE: base64Value,
						})
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
			this.socket.sendMessage('BRIGHTNESS', null, this.deviceId, {
				VALUE: value,
			})
		}
	}
}
