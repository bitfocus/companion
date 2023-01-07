import { ExpressionFunctions } from '../lib/Shared/Expression/ExpressionFunctions.js'

describe('functions', () => {
	it('round', () => {
		expect(ExpressionFunctions.round(9.99)).toBe(10)
		expect(ExpressionFunctions.round('9.99')).toBe(10)
		expect(ExpressionFunctions.round(-0)).toBe(-0)

		expect(ExpressionFunctions.round('test')).toBe(NaN)
		expect(ExpressionFunctions.round('true')).toBe(NaN)
		expect(ExpressionFunctions.round(undefined)).toBe(NaN)
		expect(ExpressionFunctions.round(true)).toBe(1)
		expect(ExpressionFunctions.round(false)).toBe(0)
	})

	it('floor', () => {
		expect(ExpressionFunctions.floor(9.99)).toBe(9)
		expect(ExpressionFunctions.floor('9.99')).toBe(9)
		expect(ExpressionFunctions.floor(-0)).toBe(-0)

		expect(ExpressionFunctions.floor('test')).toBe(NaN)
		expect(ExpressionFunctions.floor('true')).toBe(NaN)
		expect(ExpressionFunctions.floor(undefined)).toBe(NaN)
		expect(ExpressionFunctions.floor(true)).toBe(1)
		expect(ExpressionFunctions.floor(false)).toBe(0)
	})

	it('ceil', () => {
		expect(ExpressionFunctions.ceil(9.99)).toBe(10)
		expect(ExpressionFunctions.ceil('9.99')).toBe(10)
		expect(ExpressionFunctions.ceil(-0)).toBe(-0)

		expect(ExpressionFunctions.ceil('test')).toBe(NaN)
		expect(ExpressionFunctions.ceil('true')).toBe(NaN)
		expect(ExpressionFunctions.ceil(undefined)).toBe(NaN)
		expect(ExpressionFunctions.ceil(true)).toBe(1)
		expect(ExpressionFunctions.ceil(false)).toBe(0)
	})

	it('abs', () => {
		expect(ExpressionFunctions.abs(9.99)).toBe(9.99)
		expect(ExpressionFunctions.abs('-9.99')).toBe(9.99)
		expect(ExpressionFunctions.abs(-0)).toBe(0)

		expect(ExpressionFunctions.abs('test')).toBe(NaN)
		expect(ExpressionFunctions.abs('true')).toBe(NaN)
		expect(ExpressionFunctions.abs(undefined)).toBe(NaN)
		expect(ExpressionFunctions.abs(true)).toBe(1)
		expect(ExpressionFunctions.abs(false)).toBe(0)
	})

	it('fromRadix', () => {
		expect(ExpressionFunctions.fromRadix('11', 16)).toBe(17)
		expect(ExpressionFunctions.fromRadix('11', 2)).toBe(3)
		expect(ExpressionFunctions.fromRadix('f', 16)).toBe(15)
		expect(ExpressionFunctions.fromRadix('11')).toBe(11)
	})

	it('toRadix', () => {
		expect(ExpressionFunctions.toRadix(11, 16)).toBe('b')
		expect(ExpressionFunctions.toRadix(11, 2)).toBe('1011')
		expect(ExpressionFunctions.toRadix(9, 16)).toBe('9')
		expect(ExpressionFunctions.toRadix(11)).toBe('11')
	})

	it('toFixed', () => {
		expect(ExpressionFunctions.toFixed(Math.PI, 3)).toBe('3.142')
		expect(ExpressionFunctions.toFixed(Math.PI, 2)).toBe('3.14')
		expect(ExpressionFunctions.toFixed(-Math.PI, 2)).toBe('-3.14')
		expect(ExpressionFunctions.toFixed(Math.PI)).toBe('3')
		expect(ExpressionFunctions.toFixed(5, 2)).toBe('5.00')
		expect(ExpressionFunctions.toFixed(Math.PI, -2)).toBe('3')
	})

	it('isNumber', () => {
		expect(ExpressionFunctions.isNumber(11)).toBe(true)
		expect(ExpressionFunctions.isNumber('99')).toBe(true)
		expect(ExpressionFunctions.isNumber('true')).toBe(false)
		expect(ExpressionFunctions.isNumber('')).toBe(true)
		expect(ExpressionFunctions.isNumber(undefined)).toBe(false)
	})

	it('timestampToSeconds', () => {
		expect(ExpressionFunctions.timestampToSeconds('00:00:11')).toBe(11)
		expect(ExpressionFunctions.timestampToSeconds('00:16:39')).toBe(999)
		expect(ExpressionFunctions.timestampToSeconds('02:46:39')).toBe(9999)
		expect(ExpressionFunctions.timestampToSeconds('342:56:07')).toBe(1234567)

		expect(ExpressionFunctions.timestampToSeconds('00:00_11')).toBe(0)
		expect(ExpressionFunctions.timestampToSeconds(false)).toBe(0)
		expect(ExpressionFunctions.timestampToSeconds(99)).toBe(0)
	})

	it('trim', () => {
		expect(ExpressionFunctions.trim(11)).toBe('11')
		expect(ExpressionFunctions.trim('  99  ')).toBe('99')
		expect(ExpressionFunctions.trim('\t aa \n')).toBe('aa')
		expect(ExpressionFunctions.trim('')).toBe('')
		expect(ExpressionFunctions.trim(undefined)).toBe('undefined')
		expect(ExpressionFunctions.trim(false)).toBe('false')
		expect(ExpressionFunctions.trim(true)).toBe('true')
	})

	it('strlen', () => {
		expect(ExpressionFunctions.strlen(11)).toBe(2)
		expect(ExpressionFunctions.strlen('  99  ')).toBe(6)
		expect(ExpressionFunctions.strlen('\t aa \n')).toBe(6)
		expect(ExpressionFunctions.strlen('')).toBe(0)
		expect(ExpressionFunctions.strlen(undefined)).toBe(9)
		expect(ExpressionFunctions.strlen(false)).toBe(5)
		expect(ExpressionFunctions.strlen(true)).toBe(4)
	})

	it('substr', () => {
		expect(ExpressionFunctions.substr('abcdef', 2)).toBe('cdef')
		expect(ExpressionFunctions.substr('abcdef', -2)).toBe('ef')
		expect(ExpressionFunctions.substr('abcdef', 2, 4)).toBe('cd')
		expect(ExpressionFunctions.substr('abcdef', 2, -2)).toBe('cd')
		expect(ExpressionFunctions.substr('abcdef', -4, -2)).toBe('cd')
		expect(ExpressionFunctions.substr('abcdef', 0, 0)).toBe('')

		expect(ExpressionFunctions.substr(11)).toBe('11')
		expect(ExpressionFunctions.substr('', 0, 1)).toBe('')
		expect(ExpressionFunctions.substr(undefined)).toBe('undefined')
		expect(ExpressionFunctions.substr(false)).toBe('false')
		expect(ExpressionFunctions.substr(true)).toBe('true')
	})

	it('bool', () => {
		expect(ExpressionFunctions.bool(11)).toBe(true)
		expect(ExpressionFunctions.bool('99')).toBe(true)
		expect(ExpressionFunctions.bool(0)).toBe(false)
		expect(ExpressionFunctions.bool('0')).toBe(false)
		expect(ExpressionFunctions.bool(true)).toBe(true)
		expect(ExpressionFunctions.bool('true')).toBe(true)
		expect(ExpressionFunctions.bool(false)).toBe(false)
		expect(ExpressionFunctions.bool('false')).toBe(false)
		expect(ExpressionFunctions.bool('')).toBe(false)
		expect(ExpressionFunctions.bool(undefined)).toBe(false)
	})

	it('secondsToTimestamp', () => {
		expect(ExpressionFunctions.secondsToTimestamp(11)).toBe('00:00:11')
		expect(ExpressionFunctions.secondsToTimestamp(999)).toBe('00:16:39')
		expect(ExpressionFunctions.secondsToTimestamp(9999)).toBe('02:46:39')
		expect(ExpressionFunctions.secondsToTimestamp(1234567)).toBe('342:56:07')

		expect(ExpressionFunctions.secondsToTimestamp('99')).toBe('00:01:39')
		expect(ExpressionFunctions.secondsToTimestamp(false)).toBe('00:00:00')
		expect(ExpressionFunctions.secondsToTimestamp(-11)).toBe('00:00:00')
	})
})
