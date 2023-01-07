function pad(str, ch, len) {
	str += ''

	while (str.length < len) {
		str = ch + str
	}

	return str
}

// Note: when adding new functions, make sure to update the docs!
export const ExpressionFunctions = {
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
	unixNow: () => Date.now(),
	timestampToSeconds: (str) => {
		const match = (str + '').match(/^(\d+)\:(\d+)\:(\d+)$/i)
		if (match) {
			return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
		} else {
			return 0
		}
	},

	// String operations
	trim: (v) => (v + '').trim(),
	strlen: (v) => (v + '').length,
	substr: (str, start, end) => {
		return (str + '').slice(start, end)
	},
	secondsToTimestamp: (v) => {
		v = Math.max(0, v)

		const seconds = pad(Math.floor(v) % 60, '0', 2)
		const minutes = pad(Math.floor(v / 60) % 60, '0', 2)
		const hours = pad(Math.floor(v / 3600), '0', 2)

		return `${hours}:${minutes}:${seconds}`
	},

	// Bool operations
	bool: (v) => !!v && v !== 'false' && v !== '0',
}
