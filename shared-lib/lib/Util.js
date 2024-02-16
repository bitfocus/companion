/**
 * Pad a string to the specified length
 * @param {string | number} str0
 * @param {string} ch
 * @param {number} len
 * @returns {string}
 */
export function pad(str0, ch, len) {
	let str = str0 + ''

	while (str.length < len) {
		str = ch + str
	}

	return str
}
