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
