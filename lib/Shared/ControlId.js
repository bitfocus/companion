export function formatCoordinate(x, y) {
	return `${x}x${y}`
}
export function splitCoordinate(coordinate) {
	return coordinate.split('x', 2).map(Number)
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
