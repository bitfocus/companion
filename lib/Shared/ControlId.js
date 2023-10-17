/**
 * Present a location as a string
 * @param {import("../Resources/Util.js").ControlLocation} location
 * @returns {string}
 */
export function formatLocation(location) {
	return `${location.pageNumber ?? '?'}/${location.row ?? '?'}/${location.column ?? '?'}`
}

/**
 * Convert old bank index to xy
 * @param {number} bank
 * @returns {[number, number] | null}
 */
export function oldBankIndexToXY(bank) {
	bank = Number(bank)
	if (isNaN(bank) || bank <= 0 || bank > 32) return null
	bank -= 1

	const perRow = 8

	const x = bank % perRow
	const y = Math.floor(bank / perRow)
	return [x, y]
}
/**

/**
 * Combine xy values into old bank index
 * @param {number} x
 * @param {number} y
 * @returns {number | null}
 */
export function xyToOldBankIndex(x, y) {
	const perRow = 8
	if (x < 0 || y < 0 || x >= perRow || y >= 4) return null

	return y * perRow + x + 1
}

/**
 * Create full bank control id
 * @param {string} id
 * @returns {string}
 */
export function CreateBankControlId(id) {
	return `bank:${id}`
}

/**
 * Create full trigger control id
 * @param {string} triggerId
 * @returns {string}
 */
export function CreateTriggerControlId(triggerId) {
	return `trigger:${triggerId}`
}

/**
 * Parse a controlId
 * @param {string} controlId
 * @returns {{ type: 'bank', control: string } | { type: 'trigger', trigger: string} | undefined}
 */
export function ParseControlId(controlId) {
	if (typeof controlId === 'string') {
		const match = controlId.match(/^bank:(.*)$/)
		if (match) {
			return {
				type: 'bank',
				control: match[1],
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
