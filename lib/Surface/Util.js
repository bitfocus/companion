/** @typedef {{ columns: number, rows: number }} GridSize */
/** @typedef {'surface90' | 'surface-90' | 'surface180' | 'surface0'} SurfaceRotation */

/**
 * Convert a coordinate to surface index
 * @param {number} x
 * @param {number} y
 * @param {GridSize} gridSize
 * @returns {number | null}
 */
export function convertXYToIndexForPanel(x, y, gridSize) {
	if (x < 0 || y < 0 || x >= gridSize.columns || y >= gridSize.rows) return null

	return y * gridSize.columns + x
}

/**
 * Convert a surface index to coordinates
 * @param {number} index
 * @param {GridSize} gridSize
 * @returns {[x: number, y: number] | null}
 */
export function convertPanelIndexToXY(index, gridSize) {
	index = Number(index)
	if (isNaN(index) || index < 0 || index >= gridSize.columns * gridSize.rows) return null

	const x = index % gridSize.columns
	const y = Math.floor(index / gridSize.columns)
	return [x, y]
}

/**
 * Rotate a coordinate
 * @param {number} x
 * @param {number} y
 * @param {GridSize} gridSize
 * @param {SurfaceRotation} rotation
 * @returns
 */
export function rotateXYForPanel(x, y, gridSize, rotation) {
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
 * @param {number} x
 * @param {number} y
 * @param {GridSize} gridSize
 * @param {SurfaceRotation} rotation
 * @returns
 */
export function unrotateXYForPanel(x, y, gridSize, rotation) {
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
