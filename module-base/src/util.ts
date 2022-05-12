export function literal<T>(v: T): T {
	return v
}

/** Type assert that a value is never */
export function assertNever(_val: never): void {
	// Nothing to do
}

export interface RgbComponents {
	r: number
	g: number
	b: number
}

export function combineRgb(r: number, g: number, b: number): number {
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

export function splitRgb(dec: number): RgbComponents {
	return {
		r: (dec & 0xff0000) >> 16,
		g: (dec & 0x00ff00) >> 8,
		b: dec & 0x0000ff,
	}
}

export function from15to32Keys(key: number): number {
	key = key - 1

	let rows = Math.floor(key / 5)
	let col = (key % 5) + 1
	let res = rows * 8 + col

	if (res >= 32) {
		//debug('from15to32: assert: old config had bigger pages than expected')
		return 31
	}
	return res
}
