import EventEmitter from 'node:events'
import type { CompanionSurfaceConfigField, GridSize } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'
import type {
	DrawButtonItem,
	SurfaceExecuteExpressionFn,
	SurfacePanel,
	SurfacePanelEvents,
	SurfacePanelInfo,
} from '../Types.js'
import type { OpenHidDeviceResult, PluginWrapper } from '@companion-surface/base/host'
import LogController, { Logger } from '../../Log/Controller.js'
import {
	BrightnessConfigField,
	LockConfigFields,
	OffsetConfigFields,
	RotationConfigField,
} from '../CommonConfigFields.js'
import { CompanionVariableValue } from '@companion-module/base'
import { ReadonlyDeep } from 'type-fest'
import {
	SurfaceDrawProps,
	SurfaceSchemaControlStylePreset,
	SurfaceSchemaLayoutDefinition,
} from '@companion-surface/base'
import { ImageWriteQueue } from '../../Resources/ImageWriteQueue.js'
import { parseColor, parseColorToNumber, transformButtonImage } from '../../Resources/Util.js'

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
	surfaceInfo: OpenHidDeviceResult,
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

	readonly #plugin: PluginWrapper<unknown>
	readonly #surfaceInfo: OpenHidDeviceResult
	readonly #executeExpression: SurfaceExecuteExpressionFn

	readonly #controlDefinitions: ReadonlyMap<string, ResolvedControlDefinition[]>
	readonly #writeQueue: ImageWriteQueue<string, [ResolvedControlDefinition, DrawButtonItem]>

	// TODO - utilise these
	readonly #inputVariables: Record<string, SatelliteInputVariableInfo> = {}
	readonly #outputVariables: Record<string, SatelliteOutputVariableInfo> = {}

	readonly info: SurfacePanelInfo
	readonly gridSize: GridSize

	constructor(
		plugin: PluginWrapper<unknown>,
		surfaceInfo: OpenHidDeviceResult,
		executeExpression: SurfaceExecuteExpressionFn
	) {
		super()

		this.#logger = LogController.createLogger(`Surface/PluginPanel/${surfaceInfo.surfaceId}`)

		this.#plugin = plugin
		this.#surfaceInfo = surfaceInfo
		this.#executeExpression = executeExpression

		this.#controlDefinitions = resolveControlDefinitions(surfaceInfo.surfaceLayout)

		// this.#config = {
		// 	rotation: 0,
		// 	brightness: 100,
		// }

		this.#writeQueue = new ImageWriteQueue(this.#logger, async (_id, controlDefinition, drawItem) => {
			try {
				// await this.#sendDraw(controlDefinition, drawItem)

				const drawProps: SurfaceDrawProps = {
					controlId: controlDefinition.id,
				}

				const style = drawItem.image.style

				if (controlDefinition.style.bitmap) {
					const buffer = await transformButtonImage(
						drawItem.image,
						0, // TODO - this.#config.rotation,
						controlDefinition.style.bitmap.w,
						controlDefinition.style.bitmap.h,
						'rgb'
					)

					if (buffer === undefined || buffer.length == 0) {
						this.#logger.warn('buffer has invalid size')
					} else {
						drawProps.image = buffer
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

				// throw new Error('Method not implemented.')
				await this.#plugin.draw(this.#surfaceInfo.surfaceId, drawProps)
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
			devicePath: 'TODO', //surfaceInfo.path,
			type: surfaceInfo.description,
			configFields: configFields,
			// location?: string
			// firmwareUpdateVersionsUrl?: string
			// hasFirmwareUpdates?: SurfaceFirmwareUpdateInfo
		}
	}

	clearDeck(): void {
		this.#plugin.blankSurface(this.#surfaceInfo.surfaceId).catch((e) => {
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

	setConfig(config: any, force?: boolean): void {
		// throw new Error('Method not implemented.')
	}

	getDefaultConfig?: (() => any) | undefined

	onVariablesChanged?: ((allChangedVariables: Set<string>) => void) | undefined

	quit(): void {
		// TODO - forward to plugin
	}

	checkForFirmwareUpdates?: ((latestVersions?: unknown) => Promise<void>) | undefined

	setLocked(locked: boolean, characterCount: number): void {
		this.#plugin.showLockedStatus(this.#surfaceInfo.surfaceId, locked, characterCount).catch((e) => {
			this.#logger.error(`Error setting locked status: ${e.message}`)
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
}
