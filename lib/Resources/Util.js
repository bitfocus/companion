import { serializeIsVisibleFn } from '@companion-module/base/dist/internal/base.js'
import imageRs from '@julusian/image-rs'
import { colord } from 'colord'

/** @typedef {import('../Shared/Model/Common.js').ControlLocation} ControlLocation */

/**
 * Combine rgba components to a 32bit value
 * @param {number | string} a 0-255
 * @param {number | string} r 0-255
 * @param {number | string} g 0-255
 * @param {number | string} b 0-255
 * @param {number} base
 * @returns {number | false}
 */
export const argb = (a, r, g, b, base = 10) => {
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
 * @param {number} decimal
 * @returns {{ red: number, green: number, blue: number }}
 */
export const decimalToRgb = (decimal) => {
	return {
		red: (decimal >> 16) & 0xff,
		green: (decimal >> 8) & 0xff,
		blue: decimal & 0xff,
	}
}

/**
 * Combine rgb components to a 24bit value
 * @param {number | string} r 0-255
 * @param {number | string} g 0-255
 * @param {number | string} b 0-255
 * @param {number} base
 * @returns {number | false}
 */
export const rgb = (r, g, b, base = 10) => {
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
 * Convert a 24bit/32bit number itno rgb components
 * @param {number} dec
 * @returns {{ a:number, r: number, g: number, b: number }}
 */
export const rgbRev = (dec) => {
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
 * @param {number|string} color
 * @param {boolean|undefined} skipValidation defaults to false
 * @returns {string} a css color string
 */
export const parseColor = (color, skipValidation = false) => {
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
 * @param {any} color
 * @returns {number | false}
 */
export const parseColorToNumber = (color) => {
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
 * @param {number} milliseconds
 */
export const delay = (milliseconds) => {
	return new Promise((resolve) => setTimeout(resolve, milliseconds || 0))
}

export const getTimestamp = () => {
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
 * @param {number} num
 * @returns {string}
 */
export const convert2Digit = (num) => {
	if (num < 10) {
		return '0' + num
	} else {
		return num + ''
	}
}

/**
 * Check if Satellite API value is falsey
 * @param {any} val
 * @returns {boolean}
 */
export const isFalsey = (val) => {
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0' || !Boolean(val)
}

/**
 * @typedef {Record<string, string | true | undefined>} ParsedParams
 */

/**
 * Parse a Satellite API message
 * @param {string} line
 * @returns {ParsedParams}
 */
export function parseLineParameters(line) {
	const makeSafe = (/** @type {number} */ index) => {
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

	/** @type {ParsedParams} */
	const res = {}

	for (const fragment of fragments) {
		const [key, value] = fragment.split('=', 2)
		res[key] = value === undefined ? true : value
	}

	return res
}

/**
 * Clamp a value to be within a range
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
	return Math.min(Math.max(val, min), max)
}

/**
 * Translate rotation to @julusian/image-rs equivalent
 * @param {import('../Surface/Util.js').SurfaceRotation | 90 | -90 | 180 | 0 | null} rotation
 * @returns {imageRs.RotationMode | null}
 */
export function translateRotation(rotation) {
	if (rotation === 90 || rotation === 'surface90') return imageRs.RotationMode.CW270
	if (rotation === -90 || rotation === 'surface-90') return imageRs.RotationMode.CW90
	if (rotation === 180 || rotation === 'surface180') return imageRs.RotationMode.CW180
	return null
}

/**
 * Show an fatal error message to the user, and exit
 * @param {string} title
 * @param {string} message
 */
export async function showFatalError(title, message) {
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
 * @param {string} title
 * @param {string} message
 */
export async function showErrorMessage(title, message) {
	sendOverIpc({
		messageType: 'show-error',
		title,
		body: message,
	})

	console.error(message)
}

/**
 * Send message over IPC to parent
 * @param {any} data
 */
export function sendOverIpc(data) {
	if (process.env.COMPANION_IPC_PARENT && process.send) {
		process.send(data)
	}
}

/**
 * Whether the application is packaged with webpack
 * @returns {boolean}
 */
export function isPackaged() {
	return typeof __webpack_require__ === 'function'
}

/**
 * Get the size of the bitmap for a button
 * @param {import('../Registry.js').default} registry
 * @param {any} style
 * @returns {{ width: number, height: number }}
 */
export function GetButtonBitmapSize(registry, style) {
	let removeTopBar = !style.show_topbar
	if (style.show_topbar === 'default' || style.show_topbar === undefined) {
		removeTopBar = registry.userconfig.getKey('remove_topbar') === true
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

/**
 *
 * @param {*} variableId
 * @returns
 */
export function SplitVariableId(variableId) {
	const splitIndex = variableId.indexOf(':')
	if (splitIndex === -1) throw new Error(`"${variableId}" is not a valid variable id`)

	const label = variableId.substring(0, splitIndex)
	const variable = variableId.substring(splitIndex + 1)

	return [label, variable]
}

/**
 * Parse an alignment value
 * @param {string} alignment
 * @param {boolean=} validate Throw if value is invalid
 * @returns {[horizontal: 'left' | 'right' | 'center', vertical: 'top' | 'bottom' | 'center', full: string]}
 */
export function ParseAlignment(alignment, validate) {
	const [halignRaw, valignRaw] = alignment.toLowerCase().split(':', 2)

	/** @type {'left' | 'right' | 'center'} */
	let halign
	if (halignRaw !== 'left' && halignRaw !== 'right' && halignRaw !== 'center') {
		if (validate) throw new Error(`Invalid horizontal component: "${halignRaw}"`)

		halign = 'center'
	} else {
		halign = halignRaw
	}

	/** @type {'top' | 'bottom' | 'center'} */
	let valign
	if (valignRaw !== 'top' && valignRaw !== 'bottom' && valignRaw !== 'center') {
		if (validate) throw new Error(`Invalid vertical component: "${valignRaw}"`)

		valign = 'center'
	} else {
		valign = valignRaw
	}

	return [halign, valign, `${halign}:${valign}`]
}

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

/**
 *
 * @template {import('@companion-module/base').CompanionInputFieldBase | import('../Internal/Types.js').CompanionInputFieldBaseExtended} T
 * @param {T} field
 * @returns {import('../Internal/Types.js').EncodeIsVisible2<T>}
 */
export function serializeIsVisibleFnSingle(field) {
	// @ts-ignore
	return serializeIsVisibleFn([field])[0]
}
