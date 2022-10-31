export const argb = (a, r, g, b, base = 10) => {
	a = parseInt(r, base)
	r = parseInt(r, base)
	g = parseInt(g, base)
	b = parseInt(b, base)

	if (isNaN(a) || isNaN(r) || isNaN(g) || isNaN(b)) return false
	return (
		a * 0x1000000 + rgb(r, g, b) // bitwise doesn't work because JS bitwise is working with 32bit signed int
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
	dec = Math.round(dec)

	return {
		r: (dec & 0xff0000) >> 16,
		g: (dec & 0x00ff00) >> 8,
		b: dec & 0x0000ff,
	}
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
	return (typeof val === 'string' && val.toLowerCase() == 'false') || val == '0'
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

/**
 * Rotate a 72x72 pixel buffer for the given orientation
 * @param {Buffer} buffer
 * @param {0 | 90 | -90 | 180} rotation
 * @returns
 */
export const rotateBuffer = (buffer, rotation) => {
	if (!buffer || buffer.length !== 15552) {
		// malformed input, so return it back
		return buffer
	}

	if (rotation === -90) {
		let buf = Buffer.alloc(15552)

		for (let x = 0; x < 72; ++x) {
			for (let y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), y * 72 * 3 + (71 - x) * 3, 3)
			}
		}
		buffer = buf
	}

	if (rotation === 180) {
		let buf = Buffer.alloc(15552)

		for (let x = 0; x < 72; ++x) {
			for (let y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), (71 - x) * 72 * 3 + (71 - y) * 3, 3)
			}
		}
		buffer = buf
	}

	if (rotation === 90) {
		let buf = Buffer.alloc(15552)

		for (let x = 0; x < 72; ++x) {
			for (let y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE(x * 72 * 3 + y * 3, 3), (71 - y) * 72 * 3 + x * 3, 3)
			}
		}
		buffer = buf
	}

	return buffer
}

export async function showFatalError(title, message) {
	if (global.electron && global.electron.dialog) {
		dialog.showErrorBox(title, message)
	} else {
		console.error(message)
	}
	process.exit(1)
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

export function CreateBankControlId(page, bank) {
	return `bank:${page}-${bank}`
}

export function CreateTriggerControlId(triggerId) {
	return `trigger:${triggerId}`
}

export function ParseControlId(controlId) {
	if (typeof controlId === 'string') {
		const match = controlId.match(/^bank:(\d+)-(\d+)$/)
		if (match) {
			return {
				type: 'bank',
				page: Number(match[1]),
				bank: Number(match[2]),
			}
		}

		const match2 = controlId.match(/^trigger:(.*)$/)
		if (match2) {
			return {
				type: 'trigger',
				trigger: match2[1],
			}
		}
	}

	return undefined
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
