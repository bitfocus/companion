export function convertXYToIndexForPanel(x, y, panelInfo) {
	if (x < 0 || y < 0 || x >= panelInfo.keysPerRow) return null

	const key = y * panelInfo.keysPerRow + x
	if (key >= panelInfo.keysTotal) return null

	return key
}
