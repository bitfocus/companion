import EventEmitter from 'node:events'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type {
	DrawButtonItem,
	SurfaceExecuteExpressionFn,
	SurfacePanel,
	SurfacePanelEvents,
	SurfacePanelInfo,
} from './Types.js'
import LogController, { type Logger } from '../Log/Controller.js'
import {
	BrightnessConfigField,
	LockConfigFields,
	OffsetConfigFields,
	RotationConfigField,
} from './CommonConfigFields.js'
import type { CompanionVariableValue } from '@companion-module/base'
import type { ReadonlyDeep } from 'type-fest'
import type {
	OpenDeviceResult,
	SurfaceSchemaControlStylePreset,
	SurfaceSchemaLayoutDefinition,
} from '@companion-surface/host'
import { ImageWriteQueue } from '../Resources/ImageWriteQueue.js'
import { parseColor, parseColorToNumber, transformButtonImage } from '../Resources/Util.js'
import debounceFn from 'debounce-fn'
import { VARIABLE_UNKNOWN_VALUE } from '@companion-app/shared/Variables.js'
import type { IpcWrapper } from '../Instance/Surface/IpcWrapper.js'
import type {
	HostToSurfaceModuleEvents,
	IpcDrawProps,
	SurfaceModuleToHostEvents,
} from '../Instance/Surface/IpcTypes.js'

interface SatelliteInputVariableInfo {
	id: string
	lastValue: CompanionVariableValue
}
interface SatelliteOutputVariableInfo {
	id: string
	lastReferencedVariables: ReadonlySet<string> | null
	lastValue: any
	triggerUpdate?: () => void
}

function generateConfigFields(
	surfaceInfo: OpenDeviceResult,
	gridSize: GridSize,
	inputVariables: Record<string, SatelliteInputVariableInfo>,
	outputVariables: Record<string, SatelliteOutputVariableInfo>
): CompanionSurfaceConfigField[] {
	const fields: CompanionSurfaceConfigField[] = [...OffsetConfigFields]
	if (surfaceInfo.supportsBrightness) {
		fields.push(BrightnessConfigField)
	}

	// If there are any controls, add rotation and lock config
	if (gridSize.columns > 0 && gridSize.rows > 0) {
		fields.push(RotationConfigField, ...LockConfigFields)
	}

	for (const variable of surfaceInfo.transferVariables || []) {
		if (variable.type === 'input') {
			const id = `transfer_input_${variable.id}`
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
			const id = `transfer_output_${variable.id}`

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

interface ResolvedControlDefinition {
	// The id as reported by the client
	id: string
	// The row as reported by the client
	row: number
	// The column as reported by the client
	column: number
	// The styles requested by the client
	style: SurfaceSchemaControlStylePreset
}

function formatSurfaceXy(x: number, y: number): string {
	return `${y}/${x}`
}

function resolveControlDefinitions(
	surfaceManifest: ReadonlyDeep<SurfaceSchemaLayoutDefinition>
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

export class SurfacePluginPanel extends EventEmitter<SurfacePanelEvents> implements SurfacePanel {
	readonly #logger: Logger

	readonly instanceId: string

	readonly #ipcWrapper: IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>

	readonly #surfaceInfo: OpenDeviceResult
	readonly #executeExpression: SurfaceExecuteExpressionFn

	readonly #controlDefinitions: ReadonlyMap<string, ResolvedControlDefinition[]>
	readonly #writeQueue: ImageWriteQueue<string, [ResolvedControlDefinition, DrawButtonItem]>

	readonly #inputVariables: Record<string, SatelliteInputVariableInfo> = {}
	readonly #outputVariables: Record<string, SatelliteOutputVariableInfo> = {}

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	#config: Record<string, any>

	constructor(
		ipcWrapper: IpcWrapper<HostToSurfaceModuleEvents, SurfaceModuleToHostEvents>,
		instanceId: string,
		surfaceInfo: OpenDeviceResult,
		executeExpression: SurfaceExecuteExpressionFn
	) {
		super()

		this.#logger = LogController.createLogger(`Surface/PluginPanel/${surfaceInfo.surfaceId}`)

		this.instanceId = instanceId

		this.#ipcWrapper = ipcWrapper
		this.#surfaceInfo = surfaceInfo
		this.#executeExpression = executeExpression

		this.#controlDefinitions = resolveControlDefinitions(surfaceInfo.surfaceLayout)

		this.#config = {
			rotation: 0,
			brightness: 100,
		}

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (_id, controlDefinition, drawItem) => {
			try {
				const drawProps: IpcDrawProps = {
					controlId: controlDefinition.id,
				}

				const style = drawItem.image.style

				if (controlDefinition.style.bitmap) {
					const buffer = await transformButtonImage(
						drawItem.image,
						this.#config.rotation,
						controlDefinition.style.bitmap.w,
						controlDefinition.style.bitmap.h,
						'rgb'
					)

					if (buffer === undefined || buffer.length == 0) {
						this.#logger.warn('buffer has invalid size')
					} else {
						drawProps.image = buffer.toString('base64')
					}
				}

				if (controlDefinition.style.colors) {
					let bgcolor =
						typeof style !== 'string' && style ? parseColor(style.bgcolor).replaceAll(' ', '') : 'rgb(0,0,0)'
					// let fgcolor = typeof style !== 'string' && style ? parseColor(style.color).replaceAll(' ', '') : 'rgb(0,0,0)'

					if (controlDefinition.style.colors !== 'rgb') {
						bgcolor = '#' + parseColorToNumber(bgcolor).toString(16).padStart(6, '0')
						// fgcolor = '#' + parseColorToNumber(fgcolor).toString(16).padStart(6, '0')
					}

					drawProps.color = bgcolor
					// params['TEXTCOLOR'] = fgcolor
				}

				if (controlDefinition.style.text) {
					drawProps.text = (typeof style !== 'string' && style?.text) || ''
				}
				// if (controlDefinition.style.textStyle) {
				// 	params['FONT_SIZE'] = typeof style !== 'string' && style ? style.size : 'auto'
				// }

				this.#ipcWrapper
					.sendWithCb('drawControls', {
						surfaceId: this.#surfaceInfo.surfaceId,
						drawProps: [drawProps],
					})
					.catch((e) => {
						this.#logger.debug(`Draw failed: ${e}`)
					})
			} catch (e: any) {
				this.#logger.debug(`scale image failed: ${e}\n${e.stack}`)
				this.emit('remove')
				return
			}
		})

		// Find the max bounds of this surface
		this.gridSize = Object.values(surfaceInfo.surfaceLayout.controls).reduce(
			(gridSize, control): GridSize => ({
				columns: Math.max(gridSize.columns, control.column + 1),
				rows: Math.max(gridSize.rows, control.row + 1),
			}),
			{ columns: 0, rows: 0 }
		)

		const configFields = generateConfigFields(surfaceInfo, this.gridSize, this.#inputVariables, this.#outputVariables)

		this.info = {
			deviceId: surfaceInfo.surfaceId,
			devicePath: surfaceInfo.surfaceId, // Future: this will be deprecated
			type: surfaceInfo.description,
			configFields: configFields,
			location: surfaceInfo.location ?? undefined,
			// firmwareUpdateVersionsUrl?: string
			// hasFirmwareUpdates?: SurfaceFirmwareUpdateInfo
		}

		// Send all variables immediately
		for (const [name, outputVariable] of Object.entries(this.#outputVariables)) {
			this.#triggerOutputVariable(name, outputVariable)
		}
	}

	clearDeck(): void {
		this.#ipcWrapper.sendWithCb('blankSurface', { surfaceId: this.#surfaceInfo.surfaceId }).catch((e) => {
			this.#logger.error(`Error clearing deck: ${e.message}`)
		})
	}

	draw(x: number, y: number, image: ImageResult): void {
		const definitions = this.#controlDefinitions.get(formatSurfaceXy(x, y))
		if (!definitions) return

		for (const definition of definitions) {
			this.#writeQueue.queue(definition.id, definition, { x, y, image })
		}
	}

	drawMany?: ((entries: DrawButtonItem[]) => void) | undefined

	setConfig(config: Record<string, any>, force?: boolean): void {
		if ((force || this.#config.brightness != config.brightness) && config.brightness !== undefined) {
			this.#ipcWrapper
				.sendWithCb('setBrightness', {
					surfaceId: this.#surfaceInfo.surfaceId,
					brightness: config.brightness,
				})
				.catch((e) => {
					this.#logger.debug(`Set brightness failed: ${e}`)
				})
		}

		// Check if the variable name of the input variable has changed
		for (const inputVariable of Object.values(this.#inputVariables)) {
			if (config[inputVariable.id] && (force || this.#config[inputVariable.id] !== config[inputVariable.id])) {
				this.emit('setCustomVariable', config[inputVariable.id], inputVariable.lastValue)
			}
		}

		// Ensure output variables are running
		for (const [name, outputVariable] of Object.entries(this.#outputVariables)) {
			if (config[outputVariable.id] && (force || this.#config[outputVariable.id] !== config[outputVariable.id])) {
				this.#triggerOutputVariable(name, outputVariable)
				break
			}
		}

		this.#config = config
	}

	getDefaultConfig?: (() => any) | undefined

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
					const parseResult = this.#executeExpression(expressionText ?? '', this.info.deviceId, undefined)
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

					this.#ipcWrapper
						.sendWithCb('setOutputVariable', {
							surfaceId: this.#surfaceInfo.surfaceId,
							name,
							value: expressionResult,
						})
						.catch((e) => {
							this.#logger.error(`Failed updating variable ${name}: ${e.message}`)
						})
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

	quit(): void {
		// TODO - forward to plugin
	}

	checkForFirmwareUpdates?: ((latestVersions?: unknown) => Promise<void>) | undefined

	setLocked(locked: boolean, characterCount: number): void {
		this.#ipcWrapper
			.sendWithCb('setLocked', {
				surfaceId: this.#surfaceInfo.surfaceId,
				locked,
				characterCount,
			})
			.catch((e) => {
				this.#logger.debug(`Set locked status failed: ${e}`)
			})
	}

	/** Input forwarding */
	inputPress(controlId: string, pressed: boolean): void {
		const control = this.#surfaceInfo.surfaceLayout.controls[controlId]
		if (!control) {
			this.#logger.warn(`Received input for unknown controlId ${controlId}`)
			return
		}

		this.emit('click', control.column, control.row, pressed)
	}

	inputRotate(controlId: string, delta: number): void {
		const control = this.#surfaceInfo.surfaceLayout.controls[controlId]
		if (!control) {
			this.#logger.warn(`Received input for unknown controlId ${controlId}`)
			return
		}

		this.emit('rotate', control.column, control.row, delta > 0)
	}

	inputPincode(char: number): void {
		this.emit('pincodeKey', char)
	}

	/**
	 * Set the value of a variable from this surface
	 */
	inputVariableValue(variableName: string, variableValue: CompanionVariableValue): void {
		const inputVariableInfo = this.#inputVariables[variableName]
		if (!inputVariableInfo) return // Not known

		inputVariableInfo.lastValue = variableValue

		const targetCustomVariable = this.#config[inputVariableInfo.id]
		if (!targetCustomVariable) return // Not configured

		this.emit('setCustomVariable', targetCustomVariable, variableValue)
	}

	updateFirmwareUpdateInfo(firmwareUpdateUrl: string | null): void {
		this.info.hasFirmwareUpdates = firmwareUpdateUrl
			? {
					updaterDownloadUrl: firmwareUpdateUrl,
				}
			: undefined

		this.emit('firmwareUpdateInfo')
	}
}
