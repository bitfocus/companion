export function convertXYToIndexForPanel(x, y, gridSize) {
	if (x < 0 || y < 0 || x >= gridSize.columns || y >= gridSize.rows) return null

	return y * gridSize.columns + x
}

export function convertPanelIndexToXY(index, gridSize) {
	index = Number(index)
	if (isNaN(index) || index < 0 || index >= gridSize.columns * gridSize.rows) return null

	const x = index % gridSize.columns
	const y = Math.floor(index / gridSize.columns)
	return [x, y]
}

export function rotateXYForPanel(x, y, gridSize, rotation) {
	switch (rotation) {
		case 90:
			return [y, gridSize.columns - x - 1]
		case -90:
			return [gridSize.rows - y - 1, x]
		case 180:
			return [gridSize.columns - x - 1, gridSize.rows - y - 1]
		default:
			return [x, y]
	}
}

export function invertRotation(rotation) {
	switch (rotation) {
		case 90:
			return -90
		case -90:
			return 90
		default:
			return rotation
	}
}
