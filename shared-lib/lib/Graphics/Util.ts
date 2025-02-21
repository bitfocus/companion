import type { CompanionAlignment } from '@companion-module/base'
import { colord } from 'colord'

export type HorizontalAlignment = 'left' | 'right' | 'center'
export type VerticalAlignment = 'top' | 'bottom' | 'center'

export interface GraphicsOptions {
	page_direction_flipped: boolean
	page_plusminus: boolean
	remove_topbar: boolean
}

/**
 * Parse an alignment value
 * @param alignment
 * @param validate Throw if value is invalid
 */
export function ParseAlignment(
	alignment: string,
	validate?: boolean
): [horizontal: HorizontalAlignment, vertical: VerticalAlignment, full: CompanionAlignment] {
	const [halignRaw, valignRaw] = alignment.toLowerCase().split(':', 2)

	let halign: 'left' | 'right' | 'center'
	if (halignRaw !== 'left' && halignRaw !== 'right' && halignRaw !== 'center') {
		if (validate) throw new Error(`Invalid horizontal component: "${halignRaw}"`)

		halign = 'center'
	} else {
		halign = halignRaw
	}

	let valign: 'top' | 'bottom' | 'center'
	if (valignRaw !== 'top' && valignRaw !== 'bottom' && valignRaw !== 'center') {
		if (validate) throw new Error(`Invalid vertical component: "${valignRaw}"`)

		valign = 'center'
	} else {
		valign = valignRaw
	}

	return [halign, valign, `${halign}:${valign}`]
}

/**
 * Convert a 24bit/32bit number into rgb components
 */
export const rgbRev = (dec: number): { a: number; r: number; g: number; b: number } => {
	dec = Math.floor(dec)
	return {
		a: dec > 0xffffff ? (255 - ((dec & 0xff000000) >>> 24)) / 255 : 1,
		r: (dec & 0xff0000) >>> 16,
		g: (dec & 0x00ff00) >>> 8,
		b: dec & 0x0000ff,
	}
}

/**
 * parse a Companion color number or a css color string and return a css color string
 * @param color
 * @param skipValidation defaults to false
 * @returns a css color string
 */
export const parseColor = (color: number | string, skipValidation = false): string => {
	if (typeof color === 'number' || (typeof color === 'string' && !isNaN(Number(color)))) {
		const col = rgbRev(Number(color))
		return `rgba(${col.r}, ${col.g}, ${col.b}, ${col.a})`
	}
	if (typeof color === 'string') {
		if (skipValidation) return color
		if (colord(color).isValid()) {
			return color
		} else {
			return 'rgba(0, 0, 0, 0)'
		}
	}
	return 'rgba(0, 0, 0, 0)'
}
