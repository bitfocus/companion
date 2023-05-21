export function formatCoordinate(x, y) {
	return `${x}x${y}`
}
export function splitCoordinate(coordinate) {
	return coordinate.split('x', 2).map(Number)
}

export function oldBankIndexToXY(bank) {
	if (bank <= 0 || bank > 32) return null
	bank -= 1

	const perRow = 8

	const x = bank % perRow
	const y = Math.floor(bank / perRow)
	return [x, y]
}
export function oldBankIndexToCoordinate(bank) {
	const xy = oldBankIndexToXY(bank)
	if (!xy) return null
	return formatCoordinate(...xy)
}
export function xyToOldBankIndex(x, y) {
	const perRow = 8
	if (x < 0 || y < 0 || x >= perRow || y >= 4) return null

	return y * perRow + x + 1
}

export function CreateBankControlId(page, bank) {
	return `bank:${page}-${bank}`
}

export function CreateTriggerControlId(triggerId) {
	return `trigger:${triggerId}`
}

export function ParseControlId(controlId) {
	if (typeof controlId === 'string') {
		const match = controlId.match(/^bank:(\d+)-(\d+)$/)
		if (match) {
			return {
				type: 'bank',
				page: Number(match[1]),
				bank: Number(match[2]),
			}
		}

		const match2 = controlId.match(/^trigger:(.*)$/)
		if (match2) {
			return {
				type: 'trigger',
				trigger: match2[1],
			}
		}
	}

	return undefined
}
