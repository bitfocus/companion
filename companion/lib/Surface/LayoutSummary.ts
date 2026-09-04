import type {
	ClientSurfaceButtonSizesItem,
	ClientSurfaceLayoutItem,
	GridSize,
	SurfaceConfig,
	SurfaceLayoutBitmapSize,
	SurfaceSchemaControlDefinition,
	SurfaceSchemaLayoutDefinition,
} from '@companion-app/shared/Model/Surfaces.js'
import { resolveControlStylePreset } from '@companion-app/shared/SurfaceLayout.js'
import { getSurfaceName } from './Util.js'

export interface SurfaceLayoutSource {
	surfaceId: string
	config: SurfaceConfig
	isConnected: boolean
}

/**
 * Collect the stored layout of each surface, connected or not. Surfaces which have never reported a layout
 * (older configs, or entries created for a surface which has not been opened yet) are omitted.
 */
export function surfaceLayoutsFromConfigs(
	sources: Iterable<SurfaceLayoutSource>
): Record<string, ClientSurfaceLayoutItem> {
	const result: Record<string, ClientSurfaceLayoutItem> = {}

	for (const { surfaceId, config, isConnected } of sources) {
		if (!config.layout) continue

		result[surfaceId] = {
			id: surfaceId,
			type: config.type || 'Unknown',
			displayName: getSurfaceName(config, surfaceId),
			isConnected,
			layout: config.layout,
		}
	}

	return result
}

/**
 * The distinct sizes the controls of each surface are drawn at. Controls whose style has no bitmap (text or
 * led only controls) contribute nothing, so a surface can end up with no sizes at all.
 */
export function surfaceButtonSizesFromLayouts(
	layouts: Record<string, ClientSurfaceLayoutItem>
): Record<string, ClientSurfaceButtonSizesItem> {
	const result: Record<string, ClientSurfaceButtonSizesItem> = {}

	for (const [surfaceId, item] of Object.entries(layouts)) {
		const bitmapSizes: SurfaceLayoutBitmapSize[] = []
		const seenSizes = new Set<string>()

		for (const control of Object.values(item.layout.controls)) {
			const bitmap = resolveControlStylePreset(item.layout, control).bitmap
			if (!bitmap) continue

			const key = `${bitmap.w}x${bitmap.h}`
			if (seenSizes.has(key)) continue
			seenSizes.add(key)

			bitmapSizes.push({ w: bitmap.w, h: bitmap.h })
		}

		result[surfaceId] = {
			id: item.id,
			type: item.type,
			displayName: item.displayName,
			isConnected: item.isConnected,
			bitmapSizes,
		}
	}

	return result
}

/**
 * A layout for a surface which is a plain grid of identical controls, such as the emulator.
 */
export function buildGridSurfaceLayout(
	gridSize: GridSize,
	bitmap: SurfaceLayoutBitmapSize
): SurfaceSchemaLayoutDefinition {
	const controls: Record<string, SurfaceSchemaControlDefinition> = {}

	for (let row = 0; row < gridSize.rows; row++) {
		for (let column = 0; column < gridSize.columns; column++) {
			controls[`${row}/${column}`] = { row, column }
		}
	}

	return {
		stylePresets: {
			default: { bitmap: { ...bitmap } },
		},
		controls,
	}
}
