/**
 * Convert a number to rgb components
 */
export function colorToRgb(dec: number): RgbColor {
	const r = Math.round((dec & 0xff0000) >> 16)
	const g = Math.round((dec & 0x00ff00) >> 8)
	const b = Math.round(dec & 0x0000ff)

	return { r, g, b }
}
export interface RgbColor {
	r: number
	g: number
	b: number
}
