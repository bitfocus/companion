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
	const ms = v % 1000
	const seconds = Math.floor(v / 1000) % 60
	const minutes = Math.floor(v / 60000) % 60
	const Hours = Math.floor(v / 3600000) % 24
	const hours = Math.floor(v / 3600000) % 12
	const days = Math.floor(v / 86400000)

	let result = format

	result = result.replace('n', negative)

	result = result.replace('dd', pad(days, '0', 2))
	result = result.replace('HH', pad(Hours, '0', 2))
	result = result.replace('hh', pad(hours, '0', 2))
	result = result.replace('mm', pad(minutes, '0', 2))
	result = result.replace('ss', pad(seconds, '0', 2))

	result = result.replace('SSS', pad(ms, '0', 3))
	result = result.replace('SS', pad(Math.trunc(ms / 10), '0', 2))
	result = result.replace('S', pad(Math.trunc(ms / 100), '0', 1))

	result = result.replace('d', days.toString())
	result = result.replace('H', Hours.toString())
	result = result.replace('h', hours.toString())
	result = result.replace('m', minutes.toString())
	result = result.replace('s', seconds.toString())

	result = result.replace('a', (v / 3600000) % 24 > 12 ? 'PM' : 'AM')

	return result
}
