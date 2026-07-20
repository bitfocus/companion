/**
 * Pad a string to the specified length
 */
export function pad(str0: string | number, ch: string, len: number): string {
	let str = str0 + ''

	while (str.length < len) {
		str = ch + str
	}

	return str
}

/** Type assert that a value is never */
export function assertNever(_val: never): void {
	// Nothing to do
}

/**
 * Capitalize the first letter of a string
 */
export function capitalize(str: string): string {
	if (!str) return ''

	const strSafe = String(str)
	return strSafe.charAt(0).toUpperCase() + strSafe.slice(1).toLowerCase()
}
