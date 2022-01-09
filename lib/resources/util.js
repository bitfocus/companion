debug = require('debug')('utils')

const argb = function (a, r, g, b) {
	a = parseInt(r, 16)
	r = parseInt(r, 16)
	g = parseInt(g, 16)
	b = parseInt(b, 16)

	if (isNaN(a) || isNaN(r) || isNaN(g) || isNaN(b)) return false
	return (
		a * 0x1000000 + rgb(r, g, b) // bitwise doesn't work because JS bitwise is working with 32bit signed int
	)
}

const from12to32 = (key) => {
	key = key - 1

	var rows = Math.floor(key / 4)
	var col = (key % 4) + 2
	var res = rows * 8 + col

	if (res >= 32) {
		debug('from12to32: assert: old config had bigger pages than expected')
		return 31
	}
	return res
}

const from15to32 = (key) => {
	key = key - 1

	var rows = Math.floor(key / 5)
	var col = (key % 5) + 1
	var res = rows * 8 + col

	if (res >= 32) {
		debug('from15to32: assert: old config had bigger pages than expected')
		return 31
	}
	return res
}

const rgb = (r, g, b) => {
	r = parseInt(r, 16)
	g = parseInt(g, 16)
	b = parseInt(b, 16)

	if (isNaN(r) || isNaN(g) || isNaN(b)) return false
	return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff)
}

const rgbRev = (dec) => {
	dec = Math.round(dec)

	return {
		r: (dec & 0xff0000) >> 16,
		g: (dec & 0x00ff00) >> 8,
		b: dec & 0x0000ff,
	}
}

const sendResult = (answer, name, ...args) => {
	if (typeof answer === 'function') {
		answer(...args)
	} else {
		client.emit(name, ...args)
	}
}

// NOTE: *** This is a internal method. DO NOT call or override. ***
const serializeIsVisibleFn = (options = []) => {
	return options.map((option) => {
		if ('isVisible' in option) {
			if (typeof option.isVisible === 'function') {
				return {
					...option,
					isVisibleFn: option.isVisible.toString(),
					isVisible: undefined,
				}
			}
		}

		// ignore any existing `isVisibleFn` to avoid code injection
		return {
			...option,
			isVisibleFn: undefined,
		}
	})
}

module.exports = {
	argb,
	from12to32,
	from15to32,
	rgb,
	rgbRev,
	sendResult,
	serializeIsVisibleFn,
}
