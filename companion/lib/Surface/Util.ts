export type GridSize = { columns: number; rows: number }
export type SurfaceRotation = 'surface90' | 'surface-90' | 'surface180' | 'surface0'

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

/**
 * Rotate a coordinate
 */
export function rotateXYForPanel(
	x: number,
	y: number,
	gridSize: GridSize,
	rotation: SurfaceRotation
): [number, number] {
	switch (rotation) {
		case 'surface90':
			return [y, gridSize.columns - x - 1]
		case 'surface-90':
			return [gridSize.rows - y - 1, x]
		case 'surface180':
			return [gridSize.columns - x - 1, gridSize.rows - y - 1]
		default:
			return [x, y]
	}
}

/**
 * Unrotate a coordinate
 */
export function unrotateXYForPanel(
	x: number,
	y: number,
	gridSize: GridSize,
	rotation: SurfaceRotation
): [number, number] {
	switch (rotation) {
		case 'surface90':
			return [gridSize.columns - y - 1, x]
		case 'surface-90':
			return [y, gridSize.rows - x - 1]
		case 'surface180':
			return [gridSize.columns - x - 1, gridSize.rows - y - 1]
		default:
			return [x, y]
	}
}
