import { pad } from '../Util.js'
import { JSONPath } from 'jsonpath-plus'

// Note: when adding new functions, make sure to update the docs!
export const ExpressionFunctions: Record<string, (...args: any[]) => any> = {
	// General operations
	length: (v) => {
		let len = 0
		if (v === undefined || v === null) {
			len = 0
		} else if (Array.isArray(v)) {
			len = v.length
		} else if (typeof v === 'object') {
			len = Object.keys(v).length
		} else if (typeof v === 'number') {
			len = (v + '').length
		} else {
			len = v.length
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
	trim: (v) => (v + '').trim(),
	strlen: (v) => (v + '').length,
	substr: (str, start, end) => {
		return (str + '').slice(start, end)
	},
	split: (str, separator) => {
		return (str + '').split(separator)
	},
	join: (arr = [], separator = ',') => {
		return (Array.isArray(arr) ? arr : [arr]).join(separator)
	},
	concat: (...strs) => ''.concat(...strs),
	includes: (str, arg) => {
		return (str + '').includes(arg)
	},
	indexOf: (str, arg, offset) => {
		return (str + '').indexOf(arg, offset)
	},
	lastIndexOf: (str, arg, offset) => {
		return (str + '').lastIndexOf(arg, offset)
	},
	toUpperCase: (str) => {
		return (str + '').toUpperCase()
	},
	toLowerCase: (str) => {
		return (str + '').toLowerCase()
	},
	replaceAll: (str, find, replace) => {
		return (str + '').replaceAll(find, replace)
	},
	decode: (str, enc) => {
		if (enc === undefined) {
			enc = 'latin1'
		} else {
			enc = '' + enc
		}
		return Buffer.from('' + str, enc).toString('latin1')
	},
	encode: (str, enc) => {
		if (enc === undefined) {
			enc = 'latin1'
		} else {
			enc = '' + enc
		}
		return Buffer.from('' + str).toString(enc)
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
			path: path,
			json: obj,
		})

		if (shouldParseInput && typeof value !== 'number' && typeof value !== 'string' && value) {
			try {
				return JSON.stringify(value)
			} catch (e: any) {
				// Ignore
			}
		}

		return value
	},
	jsonparse: (str) => {
		try {
			return JSON.parse(str + '')
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
	arrlen: (arr = []) => {
		return (Array.isArray(arr) ? arr : [arr]).length
	},

	// Time operations
	unixNow: () => Date.now(),
	timestampToSeconds: (str) => {
		const match = (str + '').match(/^(\d+)\:(\d+)\:(\d+)$/i)
		if (match) {
			return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
		} else {
			return 0
		}
	},
	secondsToTimestamp: (v, type) => {
		let negative = v < 0
		v = Math.abs(v)

		const seconds = pad(Math.floor(v) % 60, '0', 2)
		const minutes = pad(Math.floor(v / 60) % 60, '0', 2)
		const hours = pad(Math.floor(v / 3600), '0', 2)

		if (!type) return `${negative ? '-' : ''}${hours}:${minutes}:${seconds}`

		const timestamp = []
		if (type.includes('HH') || type.includes('hh')) timestamp.push(hours)
		if (type.includes('mm')) timestamp.push(minutes)
		if (type.includes('ss')) timestamp.push(seconds)

		return (negative ? '-' : '') + timestamp.join(':')
	},
	msToTimestamp: (v, type) => {
		v = Math.max(0, v)

		const ms = v % 1000
		const seconds = pad(Math.floor(v / 1000) % 60, '0', 2)
		const minutes = pad(Math.floor(v / 60000) % 60, '0', 2)
		const hours = pad(Math.floor(v / 3600000), '0', 2)

		if (!type) return `${minutes}:${seconds}.${Math.floor(ms / 100)}`

		const timestamp = []
		if (type.includes('HH') || type.includes('hh')) timestamp.push(hours)
		if (type.includes('mm')) timestamp.push(minutes)
		if (type.includes('ss')) timestamp.push(seconds)

		let timestampStr = timestamp.join(':')
		if (type.endsWith('.ms') || type.endsWith('.S')) {
			timestampStr += `.${Math.floor(ms / 100)}`
		} else if (type.endsWith('.SS')) {
			timestampStr += `.${pad(Math.floor(ms / 10), '0', 2)}`
		} else if (type.endsWith('.SSS')) {
			timestampStr += `.${pad(ms, '0', 3)}`
		}

		return timestampStr
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
			let negative = diff.startsWith('-')

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
