import { serializeIsVisibleFn } from '@companion-module/base/dist/internal/base.js'
import imageRs from '@julusian/image-rs'
import { colord } from 'colord'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { CompanionInputFieldBaseExtended, EncodeIsVisible2 } from '@companion-app/shared/Model/Options.js'
import type { CompanionInputFieldBase } from '@companion-module/base'
import { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
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
	// @ts-ignore
	a = parseInt(a, base)
	// @ts-ignore
	r = parseInt(r, base)
	// @ts-ignore
	g = parseInt(g, base)
	// @ts-ignore
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
	// @ts-ignore
	r = parseInt(r, base)
	// @ts-ignore
	g = parseInt(g, base)
	// @ts-ignore
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
export const delay = (milliseconds: number) => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds || 0))
}

export const getTimestamp = (): string => {
	let d = new Date()
	let year = d.getFullYear().toString()
	let month = convert2Digit(d.getMonth() + 1)
	let day = convert2Digit(d.getDate())
	let hrs = convert2Digit(d.getHours())
	let mins = convert2Digit(d.getMinutes())
	let out = year + month + day + '-' + hrs + mins
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
export const isFalsey = (val: any): boolean => {
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0' || !Boolean(val)
}

/**
 * Check if Satellite API value is truthy
 */
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

	let fragments = ['']
	let quotes = 0

	let i = 0
	while (i < line.length) {
		// Find the next characters of interest
		const spaceIndex = makeSafe(line.indexOf(' ', i))
		const slashIndex = makeSafe(line.indexOf('\\', i))
		const quoteIndex = makeSafe(line.indexOf('"', i))

		// Find which is closest
		let o = Math.min(spaceIndex, slashIndex, quoteIndex)
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
export function parseStringParamWithBooleanFallback(
	list: string[],
	defaultVal: string,
	parameter: unknown
): string | null {
	const param = String(parameter)
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
	if (rotation === 90 || rotation === 'surface90') return imageRs.RotationMode.CW270
	if (rotation === -90 || rotation === 'surface-90') return imageRs.RotationMode.CW90
	if (rotation === 180 || rotation === 'surface180') return imageRs.RotationMode.CW180
	return null
}

/**
 * Offset a SurfaceRotation by a given amount in 90° steps
 * @param rotation - the rotation to apply the offset to
 * @param offset - the amount to offset by, will be rounded to full quarters
 */
export function offsetRotation(rotation: SurfaceRotation | null, offset: number): SurfaceRotation | null {
	let orig: string | number | null = rotation
	let surface = false
	if (orig === null) return null
	if (typeof orig === 'string' && orig.startsWith('surface')) {
		orig = parseInt(orig.replace('surface', ''))
		surface = true
	}

	const quarter = (Number(orig) / 90 + Math.round(offset / 90)) % 4

	let newRotation: SurfaceRotation
	if (quarter == 0) {
		newRotation = 0
	} else if (quarter == 1 || quarter == -3) {
		newRotation = 90
	} else if (quarter == 2 || quarter == -2) {
		newRotation = 180
	} else if (quarter == 3 || quarter == -1) {
		newRotation = -90
	} else {
		return null
	}

	if (surface) {
		return `surface${newRotation}`
	} else {
		return newRotation
	}
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
	let image = imageRs.ImageTransformer.fromBuffer(
		render.buffer,
		render.bufferWidth,
		render.bufferHeight,
		imageRs.PixelFormat.Rgba
	)

	const imageRsRotation = translateRotation(rotation)
	if (imageRsRotation !== null) image = image.rotate(imageRsRotation)

	image = image.scale(targetWidth, targetHeight, imageRs.ResizeMode.Fit)

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
export function sendOverIpc(data: any) {
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

export function SplitVariableId(variableId: string): [string, string] {
	const res = TrySplitVariableId(variableId)
	if (res === null) throw new Error(`"${variableId}" is not a valid variable id`)
	return res
}

export function TrySplitVariableId(variableId: string): [string, string] | null {
	if (!variableId) return null
	const splitIndex = variableId.indexOf(':')
	if (splitIndex === -1) return null

	const label = variableId.substring(0, splitIndex)
	const variable = variableId.substring(splitIndex + 1)

	return [label, variable]
}

export function serializeIsVisibleFnSingle<T extends CompanionInputFieldBase | CompanionInputFieldBaseExtended>(
	field: T
): EncodeIsVisible2<T> {
	// @ts-ignore
	return serializeIsVisibleFn([field])[0]
}

export function booleanAnd(isInverted: boolean, childValues: boolean[]): boolean {
	if (childValues.length === 0) return isInverted

	return childValues.reduce((acc, val) => acc && val, true) === !isInverted
}
