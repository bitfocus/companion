import type { GridSize } from '@companion-app/shared/Model/Surfaces.js'

/**
 * The rotation helpers live in shared-lib, so that the UI places a surface's controls on the grid exactly the way
 * the surface handler does. Re-exported here, where every existing caller already looks for them.
 */
export { rotateXYForPanel, unrotateXYForPanel } from '@companion-app/shared/SurfaceLayout.js'

/**
 * Get the display name of a surface
 */
export function getSurfaceName(config: Record<string, any>, surfaceId: string): string {
	return `${config?.name || config?.type || 'Unknown'} (${surfaceId})`
}

/**
 * Convert a coordinate to surface index
 */
export function convertXYToIndexForPanel(x: number, y: number, gridSize: GridSize): number | null {
	if (x < 0 || y < 0 || x >= gridSize.columns || y >= gridSize.rows) return null

	return y * gridSize.columns + x
}

/**
 * Convert a surface index to coordinates
 */
export function convertPanelIndexToXY(index: number, gridSize: GridSize): [x: number, y: number] | null {
	index = Number(index)
	if (isNaN(index) || index < 0 || index >= gridSize.columns * gridSize.rows) return null

	const x = index % gridSize.columns
	const y = Math.floor(index / gridSize.columns)
	return [x, y]
}
