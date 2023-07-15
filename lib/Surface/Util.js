export function convertXYToIndexForPanel(x, y, panelInfo) {
	if (x < 0 || y < 0 || x >= panelInfo.keysPerRow) return null

	const key = y * panelInfo.keysPerRow + x
	if (key >= panelInfo.keysTotal) return null

	return key
}

export function convertPanelIndexToXY(index, panelInfo) {
	index = Number(index)
	if (isNaN(index) || index < 0 || index >= panelInfo.keysTotal) return null

	const x = index % panelInfo.keysPerRow
	const y = Math.floor(index / panelInfo.keysPerRow)
	return [x, y]
}
