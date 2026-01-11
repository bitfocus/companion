import * as imageRs from '@julusian/image-rs'
import { colord } from 'colord'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'

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
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isFalsey = (val: any): boolean => {
	// eslint-disable-next-line no-extra-boolean-cast
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0' || !Boolean(val)
}

/**
 * Check if Satellite API value is truthy
 */
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const isTruthy = (val: any): boolean => {
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
 * Rotate a resolution based on a SurfaceRotation
 */
export function rotateResolution(width: number, height: number, rotation: SurfaceRotation | null): [number, number] {
	if (rotation === 90 || rotation === 'surface90' || rotation === -90 || rotation === 'surface-90') {
		return [height, width]
	} else {
		return [width, height]
	}
}

/**
 * Transform a button image render to the format needed for a surface integration
 */
export async function transformButtonImage(
	buffer: Buffer,
	bufferWidth: number,
	bufferHeight: number,
	rotation: SurfaceRotation | null,
	targetWidth: number,
	targetHeight: number,
	targetFormat: imageRs.PixelFormat
): Promise<Buffer> {
	let image = imageRs.ImageTransformer.fromBuffer(buffer, bufferWidth, bufferHeight, 'rgba')

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
 * Lazy compute a value
 * @param fn Function to compute the value
 * @returns Function that returns the computed value, only computed once
 */
export function lazy<T>(fn: () => T): () => T | undefined {
	let value: T | undefined
	let valueSet = false

	return () => {
		if (!valueSet) {
			value = fn()
			valueSet = true
		}
		return value
	}
}
