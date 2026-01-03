import { msToStamp, pad } from '../Util.js'
import { JSONPath } from 'jsonpath-plus'
import { countGraphemes } from 'unicode-segmenter/grapheme'

function toString(v: any): string {
	if (v === undefined) return ''
	return v + ''
}

// Note: when adding new functions, make sure to update the docs!
export const ExpressionFunctions: Record<string, (...args: any[]) => any> = {
	// General operations
	length: (v) => {
		let len = 0
		if (v === undefined || v === null) {
			len = 0
		} else if (Array.isArray(v)) {
			len = v.length
		} else if (typeof v === 'number') {
			len = (v + '').length
		} else if (typeof v === 'bigint') {
			len = v.toString().length
		} else if (typeof v === 'string') {
			// So we handle UTF graphemes correctly
			len = countGraphemes(v)
		} else if (v instanceof RegExp) {
			len = v.toString().length
		} else if (typeof v === 'object') {
			len = Object.keys(v).length
		} else {
			// If it's got to here, we don't know how to handle it
			len = NaN
		}
		return len
	},

	// Number operations
	// TODO: round to fractionals, without fp issues
	round: (v) => Math.round(v),
	floor: (v) => Math.floor(v),
	ceil: (v) => Math.ceil(v),
	abs: (v) => Math.abs(v),
	fromRadix: (v, radix) => parseInt(v, radix || 10),
	toRadix: (v, radix) => v.toString(radix || 10),
	toFixed: (v, dp) => Number(v).toFixed(Math.max(0, dp || 0)),
	isNumber: (v) => !isNaN(v),
	max: (...args) => Math.max(...args),
	min: (...args) => Math.min(...args),
	randomInt: (min = 0, max = 10) => {
		min = Number(min)
		max = Number(max)
		return min + Math.round(Math.random() * (max - min))
	},
	log: (v) => Math.log(v),
	log10: (v) => Math.log10(v),

	// String operations
	trim: (v) => toString(v).trim(),
	strlen: (v) => toString(v).length,
	substr: (str, start, end) => {
		return toString(str).slice(start, end)
	},
	split: (str, separator) => {
		if (separator === undefined) {
			return [toString(str)]
		}
		return toString(str).split(toString(separator))
	},
	join: (arr = [], separator = ',') => {
		return (Array.isArray(arr) ? arr.map(toString) : [toString(arr)]).join(toString(separator))
	},
	concat: (...strs) => ''.concat(...strs.map(toString)),
	includes: (str, arg) => {
		return toString(str).includes(toString(arg))
	},
	indexOf: (str, arg, offset) => {
		return toString(str).indexOf(toString(arg), offset)
	},
	lastIndexOf: (str, arg, offset) => {
		return toString(str).lastIndexOf(toString(arg), offset)
	},
	toUpperCase: (str) => {
		return toString(str).toUpperCase()
	},
	toLowerCase: (str) => {
		return toString(str).toLowerCase()
	},
	replaceAll: (str, find, replace) => {
		return toString(str).replaceAll(toString(find), toString(replace))
	},
	decode: (str, enc) => {
		if (enc === undefined) {
			enc = 'latin1'
		} else {
			enc = '' + enc
		}
		return Buffer.from(toString(str), enc).toString('latin1')
	},
	encode: (str, enc) => {
		if (enc === undefined) {
			enc = 'latin1'
		} else {
			enc = '' + enc
		}
		return Buffer.from(toString(str)).toString(enc)
	},

	// Bool operations
	bool: (v) => !!v && v !== 'false' && v !== '0',

	// Object/array operations
	jsonpath: (obj, path) => {
		const shouldParseInput = typeof obj === 'string'
		if (shouldParseInput) {
			try {
				obj = JSON.parse(obj)
			} catch (_e) {
				// Ignore
			}
		}

		const value = JSONPath({
			wrap: false,
			path: toString(path),
			json: obj,
		})

		if (shouldParseInput && typeof value !== 'number' && typeof value !== 'string' && value) {
			try {
				return JSON.stringify(value)
			} catch (_e) {
				// Ignore
			}
		}

		return value
	},
	jsonparse: (str) => {
		try {
			return JSON.parse(toString(str))
		} catch (_e) {
			return null
		}
	},
	jsonstringify: (obj) => {
		try {
			return JSON.stringify(obj)
		} catch (_e) {
			return null
		}
	},
	arrayIncludes: (arr, val) => {
		if (!Array.isArray(arr)) return false
		return arr.includes(val)
	},
	arrayIndexOf: (arr, val, offset) => {
		if (!Array.isArray(arr)) return false
		return arr.indexOf(val, offset)
	},
	arrayLastIndexOf: (arr, val, offset) => {
		if (!Array.isArray(arr)) return false
		return arr.lastIndexOf(val, offset ?? arr.length)
	},

	// Time operations
	unixNow: () => Date.now(),
	timestampToSeconds: (str) => {
		const match = (str + '').match(/^(\d+):(\d+):(\d+)$/i)
		if (match) {
			return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
		} else {
			return 0
		}
	},
	secondsToTimestamp: (v, type) => {
		type = type ? type : 'nHH:mm:ss'
		v = v * 1000
		return msToStamp(v, type)
	},
	msToTimestamp: (v, type) => {
		type = type ? type : 'nmm:ss.S'
		return msToStamp(v, type)
	},
	timeOffset: (time, offset, hr12 = false) => {
		const date = new Date()

		date.setHours(time.split(':')[0])
		date.setMinutes(time.split(':')[1])
		date.setSeconds(time.split(':')[2] || 0)

		let diff = offset

		if (typeof offset === 'string') {
			let hours = 0
			let minutes = 0
			let seconds = 0
			const negative = diff.startsWith('-')

			if (diff.startsWith('+') || diff.startsWith('-')) {
				diff = diff.substr(1)
			}

			if (offset.includes(':')) {
				const split = diff.split(':')
				hours = parseInt(split[0]) || 0
				minutes = parseInt(split[1]) || 0
				seconds = parseInt(split[2]) || 0
			} else {
				hours = parseInt(diff) || 0
			}

			date.setHours(date.getHours() + (negative ? -hours : hours))
			date.setMinutes(date.getMinutes() + (negative ? -minutes : minutes))
			date.setSeconds(date.getSeconds() + (negative ? -seconds : seconds))
		} else {
			date.setHours(date.getHours() + diff)
		}

		const displayHours = pad(date.getHours() > 12 && hr12 ? date.getHours() - 12 : date.getHours(), '0', 2)
		const displayMinutes = pad(date.getMinutes(), '0', 2)
		const displaySeconds = pad(date.getSeconds(), '0', 2)

		if (time.split(':').length === 2) {
			return `${displayHours}:${displayMinutes}`
		} else if (time.split(':').length === 3) {
			return `${displayHours}:${displayMinutes}:${displaySeconds}`
		} else {
			return ''
		}
	},
	timeDiff: (from, to) => {
		let diff = 0
		let fromDate = new Date()
		let toDate = new Date()

		if (from.includes('T')) {
			fromDate = new Date(from)
		} else {
			fromDate.setHours(from.split(':')[0])
			fromDate.setMinutes(from.split(':')[1])
			fromDate.setSeconds(from.split(':')[2] || 0)
		}

		if (to.includes('T')) {
			toDate = new Date(to)
		} else {
			toDate.setHours(to.split(':')[0])
			toDate.setMinutes(to.split(':')[1])
			toDate.setSeconds(to.split(':')[2] || 0)
		}

		diff = toDate.getTime() - fromDate.getTime()

		if (isNaN(diff)) return 'ERR'

		return Math.round(diff / 1000)
	},
}
