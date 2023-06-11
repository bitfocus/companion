import imageRs from '@julusian/image-rs'
import { colord } from 'colord'

export const argb = (a, r, g, b, base = 10) => {
	a = parseInt(a, base)
	r = parseInt(r, base)
	g = parseInt(g, base)
	b = parseInt(b, base)

	if (isNaN(a) || isNaN(r) || isNaN(g) || isNaN(b)) return false
	return (
		(255 - a) * 0x1000000 + rgb(r, g, b) // bitwise doesn't work because JS bitwise is working with 32bit signed int
	)
}

export const decimalToRgb = (decimal) => {
	return {
		red: (decimal >> 16) & 0xff,
		green: (decimal >> 8) & 0xff,
		blue: decimal & 0xff,
	}
}

export const rgb = (r, g, b, base = 10) => {
	r = parseInt(r, base)
	g = parseInt(g, base)
	b = parseInt(b, base)

	if (isNaN(r) || isNaN(g) || isNaN(b)) return false
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

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
	if (typeof color === 'string') {
		if (skipValidation) return color
		if (colord(color).isValid()) {
			return color
		} else {
			return 'rgba(0, 0, 0, 0)'
		}
	}
	if (typeof color === 'number') {
		const col = rgbRev(color)
		return `rgba(${col.r}, ${col.g}, ${col.b}, ${col.a})`
	}
	return 'rgba(0, 0, 0, 0)'
}

export const delay = (milliseconds) => {
	return new Promise((resolve) => {
		setTimeout(() => resolve(), milliseconds)
	})
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
export const convert2Digit = (num) => {
	if (num < 10) {
		num = '0' + num
	}
	return num
}

export const isFalsey = (val) => {
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0' || !Boolean(val)
}

export function parseLineParameters(line) {
	const makeSafe = (index) => {
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

	const res = {}

	for (const fragment of fragments) {
		const [key, value] = fragment.split('=', 2)
		res[key] = value === undefined ? true : value
	}

	return res
}

export function clamp(val, min, max) {
	return Math.min(Math.max(val, min), max)
}

// From Global key number 0->31, to Device key f.ex 0->14
// 0-4 would be 0-4, but 5-7 would be -1
// and 8-12 would be 5-9
export const toDeviceKey = (keysTotal, keysPerRow, key) => {
	if (keysTotal == global.MAX_BUTTONS) {
		return key
	}

	if (key % global.MAX_BUTTONS_PER_ROW > keysPerRow) {
		return -1
	}

	let row = Math.floor(key / global.MAX_BUTTONS_PER_ROW)
	let col = key % global.MAX_BUTTONS_PER_ROW

	if (row >= keysTotal / keysPerRow || col >= keysPerRow) {
		return -1
	}

	return row * keysPerRow + col
}

// From device key number to global key number
// Reverse of toDeviceKey
export const toGlobalKey = (keysPerRow, key) => {
	let rows = Math.floor(key / keysPerRow)
	let col = key % keysPerRow

	return rows * global.MAX_BUTTONS_PER_ROW + col
}

export function translateRotation(rotation) {
	if (rotation === 90) return imageRs.RotationMode.CW270
	if (rotation === -90) return imageRs.RotationMode.CW90
	if (rotation === 180) return imageRs.RotationMode.CW180
	return null
}

export async function showFatalError(title, message) {
	sendOverIpc({
		messageType: 'fatal-error',
		title,
		body: message,
	})

	console.error(message)
	process.exit(1)
}

export async function showErrorMessage(title, message) {
	sendOverIpc({
		messageType: 'show-error',
		title,
		body: message,
	})

	console.error(message)
}

export function sendOverIpc(data) {
	if (process.env.COMPANION_IPC_PARENT && process.send) {
		process.send(data)
	}
}

/**
 * Whether the application is packaged with webpack
 */
export function isPackaged() {
	return typeof __webpack_require__ === 'function'
}

/**
 * Get the size of the bitmap for a button
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

export function SplitVariableId(variableId) {
	const splitIndex = variableId.indexOf(':')
	if (splitIndex === -1) throw new Error(`"${variableId}" is not a valid variable id`)

	const label = variableId.substring(0, splitIndex)
	const variable = variableId.substring(splitIndex + 1)

	return [label, variable]
}

export function ParseAlignment(alignment, validate) {
	let [halign, valign] = alignment.toLowerCase().split(':', 2)

	if (halign !== 'left' && halign !== 'right' && halign !== 'center') {
		if (validate) throw new Error(`Invalid horizontal component: "${halign}"`)

		halign = 'center'
	}
	if (valign !== 'top' && valign !== 'bottom' && valign !== 'center') {
		if (validate) throw new Error(`Invalid vertical component: "${valign}"`)

		valign = 'center'
	}

	return [halign, valign, `${halign}:${valign}`]
}

export async function sleep(duration) {
	return new Promise((resolve) => setTimeout(resolve, duration || 0))
}
