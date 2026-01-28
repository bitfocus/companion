import * as imageRs from '@julusian/image-rs'
import { colord } from 'colord'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionAlignment } from '@companion-module/base'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type { DataUserConfig } from '../Data/UserConfig.js'

/**
 * Combine rgba components to a 32bit value
 * @param a 0-255
 * @param r 0-255
 * @param g 0-255
 * @param b 0-255
 * @param base
 */
export function argb(
	a: number | string,
	r: number | string,
	g: number | string,
	b: number | string,
	base = 10
): number | false {
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	a = parseInt(a, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	r = parseInt(r, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	g = parseInt(g, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	b = parseInt(b, base)

	const rgbVal = rgb(r, g, b)
	if (isNaN(a) || rgbVal === false) return false

	return (
		(255 - a) * 0x1000000 + rgbVal // bitwise doesn't work because JS bitwise is working with 32bit signed int
	)
}

/**
 * Convert a 24bit number itno rgb components
 */
export const decimalToRgb = (decimal: number): { red: number; green: number; blue: number } => {
	return {
		red: (decimal >> 16) & 0xff,
		green: (decimal >> 8) & 0xff,
		blue: decimal & 0xff,
	}
}

/**
 * Combine rgb components to a 24bit value
 * @param r 0-255
 * @param g 0-255
 * @param b 0-255
 * @param base
 */
export const rgb = (r: number | string, g: number | string, b: number | string, base = 10): number | false => {
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	r = parseInt(r, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	g = parseInt(g, base)
	// @ts-expect-error TypeScript doesn't like parseInt with a number
	b = parseInt(b, base)

	if (isNaN(r) || isNaN(g) || isNaN(b)) return false
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

/**
 * Convert a 24bit/32bit number itno rgb components
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

/**
 * Parse a css color string to a number
 */
export const parseColorToNumber = (color: string | number | Uint8Array): number | false => {
	if (typeof color === 'string') {
		const newColor = colord(color)
		if (newColor.isValid()) {
			return rgb(newColor.rgba.r, newColor.rgba.g, newColor.rgba.b)
		} else {
			return false
		}
	}
	if (typeof color === 'number') {
		return color
	}
	return false
}

/**
 * @param milliseconds
 */
export const delay = async (milliseconds: number): Promise<void> => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds || 0))
}

export const getTimestamp = (): string => {
	const d = new Date()
	const year = d.getFullYear().toString()
	const month = convert2Digit(d.getMonth() + 1)
	const day = convert2Digit(d.getDate())
	const hrs = convert2Digit(d.getHours())
	const mins = convert2Digit(d.getMinutes())
	const out = year + month + day + '-' + hrs + mins
	return out
}

/**
 * Convert a number to a 2 digit string
 */
export const convert2Digit = (num: number): string => {
	if (num < 10) {
		return '0' + num
	} else {
		return num + ''
	}
}

/**
 * Check if Satellite API value is falsey
 */
export const isFalsey = (val: unknown): boolean => {
	// eslint-disable-next-line no-extra-boolean-cast
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0' || !Boolean(val)
}

/**
 * Check if Satellite API value is truthy
 */
export const isTruthy = (val: unknown): boolean => {
	return (
		!isFalsey(val) &&
		((typeof val === 'string' && (val.toLowerCase() == 'true' || val.toLowerCase() == 'yes')) || Number(val) >= 1)
	)
}

export type ParsedParams = Record<string, string | true | undefined>

/**
 * Parse a Satellite API message
 */
export function parseLineParameters(line: string): ParsedParams {
	const makeSafe = (index: number) => {
		return index === -1 ? Number.POSITIVE_INFINITY : index
	}

	const fragments = ['']
	let quotes = 0

	let i = 0
	while (i < line.length) {
		// Find the next characters of interest
		const spaceIndex = makeSafe(line.indexOf(' ', i))
		const slashIndex = makeSafe(line.indexOf('\\', i))
		const quoteIndex = makeSafe(line.indexOf('"', i))

		// Find which is closest
		const o = Math.min(spaceIndex, slashIndex, quoteIndex)
		if (!isFinite(o)) {
			// None were found, copy the remainder and stop
			const slice = line.substring(i)
			fragments[fragments.length - 1] += slice

			break
		} else {
			// copy the slice before this character
			const slice = line.substring(i, o)
			fragments[fragments.length - 1] += slice

			const c = line[o]
			if (c == '\\') {
				// If char is a slash, the character following it is of interest
				// Future: does this consider non \" chars?
				fragments[fragments.length - 1] += line[o + 1]

				i = o + 2
			} else {
				i = o + 1

				// Figure out what the char was
				if (c === '"') {
					quotes ^= 1
				} else if (!quotes && c === ' ') {
					fragments.push('')
				} else {
					fragments[fragments.length - 1] += c
				}
			}
		}
	}

	const res: ParsedParams = {}

	for (const fragment of fragments) {
		const [key, value] = fragment.split('=', 2)
		res[key] = value === undefined ? true : value
	}

	return res
}

/**
 * Checks if parameter is one of the list and returns it if so.
 * If it is not in the list but a trueish value, the defaultVal will be returned.
 * Otherwise returns null.
 */
export function parseStringParamWithBooleanFallback<T extends string>(
	list: T[],
	defaultVal: T,
	parameter: unknown
): T | null {
	const param = String(parameter) as T
	if (list.includes(param)) {
		return param
	}
	if (isTruthy(parameter)) {
		return defaultVal
	}
	return null
}

/**
 * Clamp a value to be within a range
 */
export function clamp(val: number, min: number, max: number): number {
	return Math.min(Math.max(val, min), max)
}

/**
 * Translate rotation to @julusian/image-rs equivalent
 */
export function translateRotation(rotation: SurfaceRotation | null): imageRs.RotationMode | null {
	if (rotation === 90 || rotation === 'surface90') return 'CW270'
	if (rotation === -90 || rotation === 'surface-90') return 'CW90'
	if (rotation === 180 || rotation === 'surface180') return 'CW180'
	return null
}

/**
 * Transform a button image render to the format needed for a surface integration
 */
export async function transformButtonImage(
	render: ImageResult,
	rotation: SurfaceRotation | null,
	targetWidth: number,
	targetHeight: number,
	targetFormat: imageRs.PixelFormat
): Promise<Buffer> {
	let image = imageRs.ImageTransformer.fromBuffer(render.buffer, render.bufferWidth, render.bufferHeight, 'rgba')

	const imageRsRotation = translateRotation(rotation)
	if (imageRsRotation !== null) image = image.rotate(imageRsRotation)

	image = image.scale(targetWidth, targetHeight, 'Fit')

	// pad, in case a button is non-square
	const dimensions = image.getCurrentDimensions()
	const xOffset = (targetWidth - dimensions.width) / 2
	const yOffset = (targetHeight - dimensions.height) / 2
	image = image.pad(Math.floor(xOffset), Math.ceil(xOffset), Math.floor(yOffset), Math.ceil(yOffset), {
		red: 0,
		green: 0,
		blue: 0,
		alpha: 255,
	})

	const computedImage = await image.toBuffer(targetFormat)
	return computedImage.buffer
}

export function uint8ArrayToBuffer(arr: Uint8Array | Uint8ClampedArray): Buffer {
	return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
}

/**
 * Show an fatal error message to the user, and exit
 */
export function showFatalError(title: string, message: string): void {
	sendOverIpc({
		messageType: 'fatal-error',
		title,
		body: message,
	})

	console.error(message)
	// eslint-disable-next-line n/no-process-exit
	process.exit(1)
}

/**
 * Show an error message to the user
 */
export function showErrorMessage(title: string, message: string): void {
	sendOverIpc({
		messageType: 'show-error',
		title,
		body: message,
	})

	console.error(message)
}

/**
 * Send message over IPC to parent
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function sendOverIpc(data: any): void {
	if (process.env.COMPANION_IPC_PARENT && process.send) {
		process.send(data)
	}
}

/**
 * Whether the application is packaged with webpack
 */
export function isPackaged(): boolean {
	return typeof __webpack_require__ === 'function'
}

/**
 * Get the size of the bitmap for a button
 */
export function GetButtonBitmapSize(
	userConfig: DataUserConfig,
	style: ButtonStyleProperties
): { width: number; height: number } {
	let removeTopBar = !style.show_topbar
	if (style.show_topbar === 'default' || style.show_topbar === undefined) {
		removeTopBar = userConfig.getKey('remove_topbar') === true
	}

	if (removeTopBar) {
		return {
			width: 72,
			height: 72,
		}
	} else {
		return {
			width: 72,
			height: 58,
		}
	}
}

export type HorizontalAlignment = 'left' | 'right' | 'center'
export type VerticalAlignment = 'top' | 'bottom' | 'center'

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
