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

export function msToStamp(v: number, format: string): string {
	const negative = v < 0 ? '-' : ''
	v = Math.abs(v)

	let result = format

	result = result.replace('n', negative)

	result = result.replace('HH', pad(Math.floor(v / 3600000), '0', 2))
	result = result.replace('hh', pad(Math.floor(v / 3600000) % 12, '0', 2))
	result = result.replace('mm', pad(Math.floor(v / 60000) % 60, '0', 2))
	result = result.replace('ss', pad(Math.floor(v / 1000) % 60, '0', 2))

	const ms = v % 1000
	result = result.replace('ms', pad(Math.trunc(ms / 100), '0', 1))
	result = result.replace('SSS', pad(ms, '0', 3))
	result = result.replace('SS', pad(Math.trunc(ms / 10), '0', 2))
	result = result.replace('S', pad(Math.trunc(ms / 100), '0', 1))

	result = result.replace('H', Math.floor(v / 3600000).toString())
	result = result.replace('h', (Math.floor(v / 3600000) % 12).toString())
	result = result.replace('m', (Math.floor(v / 60000) % 60).toString())
	result = result.replace('s', (Math.floor(v / 1000) % 60).toString())

	result = result.replace('a', v / 3600000 >= 12 ? 'PM' : 'AM')

	return result
}
