import { ExpressionFunctions } from '../lib/Shared/Expression/ExpressionFunctions.js'

describe('functions', () => {
	describe('number', () => {
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

		it('max', () => {
			expect(ExpressionFunctions.max()).toBe(Number.NEGATIVE_INFINITY)
			expect(ExpressionFunctions.max(9, 1, 3)).toBe(9)
			expect(ExpressionFunctions.max(9.9, 1.9)).toBe(9.9)
			expect(ExpressionFunctions.max('a', 1, 9)).toBe(NaN)
		})

		it('min', () => {
			expect(ExpressionFunctions.min()).toBe(Number.POSITIVE_INFINITY)
			expect(ExpressionFunctions.min(9, 1, 3)).toBe(1)
			expect(ExpressionFunctions.min(9.9, 1.9)).toBe(1.9)
			expect(ExpressionFunctions.min('a', 1, 9)).toBe(NaN)
		})

		it('unixNow', () => {
			const value = ExpressionFunctions.unixNow()
			expect(value / 10).toBeCloseTo(Date.now() / 10, 0)
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

		it('randomInt', () => {
			for (let i = 0; i < 50; i++) {
				const result = ExpressionFunctions.randomInt()
				expect(result).toBeGreaterThanOrEqual(0)
				expect(result).toBeLessThanOrEqual(10)
			}

			for (let i = 0; i < 50; i++) {
				const result = ExpressionFunctions.randomInt(-10, '5')
				expect(result).toBeGreaterThanOrEqual(-10)
				expect(result).toBeLessThanOrEqual(5)
			}
		})
	})

	describe('string', () => {
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

		it('concat', () => {
			expect(ExpressionFunctions.concat()).toBe('')
			expect(ExpressionFunctions.concat(9, 'ab')).toBe('9ab')
			expect(ExpressionFunctions.concat('ab', 9)).toBe('ab9')
			expect(ExpressionFunctions.concat(1, 9)).toBe('19')
			expect(ExpressionFunctions.concat(false)).toBe('false')
		})

		it('includes', () => {
			expect(ExpressionFunctions.includes(912, 12)).toBe(true)
			expect(ExpressionFunctions.includes(912, '91')).toBe(true)
			expect(ExpressionFunctions.includes(912, '92')).toBe(false)
			expect(ExpressionFunctions.includes(false, 'al')).toBe(true)
			expect(ExpressionFunctions.includes(false, 'tru')).toBe(false)
			expect(ExpressionFunctions.includes('something else', 'ng el')).toBe(true)
			expect(ExpressionFunctions.includes('somethingelse', 'ng el')).toBe(false)
		})

		it('indexOf', () => {
			expect(ExpressionFunctions.indexOf(912, 12)).toBe(1)
			expect(ExpressionFunctions.indexOf(912, '91')).toBe(0)
			expect(ExpressionFunctions.indexOf(912, '92')).toBe(-1)
			expect(ExpressionFunctions.indexOf(false, 'al')).toBe(1)
			expect(ExpressionFunctions.indexOf(false, 'tru')).toBe(-1)
			expect(ExpressionFunctions.indexOf('something else', 'ng el')).toBe(7)
			expect(ExpressionFunctions.indexOf('somethingelse', 'ng el')).toBe(-1)
			expect(ExpressionFunctions.indexOf('1234512345', '34')).toBe(2)
		})

		it('lastIndexOf', () => {
			expect(ExpressionFunctions.lastIndexOf(912, 12)).toBe(1)
			expect(ExpressionFunctions.lastIndexOf(912, '91')).toBe(0)
			expect(ExpressionFunctions.lastIndexOf(912, '92')).toBe(-1)
			expect(ExpressionFunctions.lastIndexOf(false, 'al')).toBe(1)
			expect(ExpressionFunctions.lastIndexOf(false, 'tru')).toBe(-1)
			expect(ExpressionFunctions.lastIndexOf('something else', 'ng el')).toBe(7)
			expect(ExpressionFunctions.lastIndexOf('somethingelse', 'ng el')).toBe(-1)
			expect(ExpressionFunctions.lastIndexOf('1234512345', '34')).toBe(7)
		})

		it('toUpperCase', () => {
			expect(ExpressionFunctions.toUpperCase(11)).toBe('11')
			expect(ExpressionFunctions.toUpperCase('anoNs2')).toBe('ANONS2')
			expect(ExpressionFunctions.toUpperCase(undefined)).toBe('UNDEFINED')
			expect(ExpressionFunctions.toUpperCase(false)).toBe('FALSE')
			expect(ExpressionFunctions.toUpperCase(true)).toBe('TRUE')
		})

		it('toLowerCase', () => {
			expect(ExpressionFunctions.toLowerCase(11)).toBe('11')
			expect(ExpressionFunctions.toLowerCase('anoNs2')).toBe('anons2')
			expect(ExpressionFunctions.toLowerCase(undefined)).toBe('undefined')
			expect(ExpressionFunctions.toLowerCase(false)).toBe('false')
			expect(ExpressionFunctions.toLowerCase(true)).toBe('true')
		})

		it('replaceAll', () => {
			expect(ExpressionFunctions.replaceAll(11, 1, 2)).toBe('22')
			expect(ExpressionFunctions.replaceAll(false, 'a', false)).toBe('ffalselse')
			expect(ExpressionFunctions.replaceAll(true, 'e', true)).toBe('trutrue')
		})

		it('secondsToTimestamp', () => {
			expect(ExpressionFunctions.secondsToTimestamp(11)).toBe('00:00:11')
			expect(ExpressionFunctions.secondsToTimestamp(999)).toBe('00:16:39')
			expect(ExpressionFunctions.secondsToTimestamp(9999)).toBe('02:46:39')
			expect(ExpressionFunctions.secondsToTimestamp(1234567)).toBe('342:56:07')

			expect(ExpressionFunctions.secondsToTimestamp('99')).toBe('00:01:39')
			expect(ExpressionFunctions.secondsToTimestamp(false)).toBe('00:00:00')
			expect(ExpressionFunctions.secondsToTimestamp(-11)).toBe('00:00:00')

			// hh:mm:ss
			expect(ExpressionFunctions.secondsToTimestamp(11, 'hh:mm:ss')).toBe('00:00:11')
			expect(ExpressionFunctions.secondsToTimestamp(9999, 'hh:mm:ss')).toBe('02:46:39')
			expect(ExpressionFunctions.secondsToTimestamp(1234567, 'hh:mm:ss')).toBe('342:56:07')

			// hh:ss
			expect(ExpressionFunctions.secondsToTimestamp(11, 'hh:ss')).toBe('00:11')
			expect(ExpressionFunctions.secondsToTimestamp(9999, 'hh:ss')).toBe('02:39')
			expect(ExpressionFunctions.secondsToTimestamp(1234567, 'hh:ss')).toBe('342:07')

			// hh:mm
			expect(ExpressionFunctions.secondsToTimestamp(11, 'hh:mm')).toBe('00:00')
			expect(ExpressionFunctions.secondsToTimestamp(9999, 'hh:mm')).toBe('02:46')
			expect(ExpressionFunctions.secondsToTimestamp(1234567, 'hh:mm')).toBe('342:56')

			// mm:ss
			expect(ExpressionFunctions.secondsToTimestamp(11, 'mm:ss')).toBe('00:11')
			expect(ExpressionFunctions.secondsToTimestamp(9999, 'mm:ss')).toBe('46:39')
			expect(ExpressionFunctions.secondsToTimestamp(1234567, 'mm:ss')).toBe('56:07')
		})

		it('msToTimestamp', () => {
			expect(ExpressionFunctions.msToTimestamp(1100)).toBe('00:01.1')
			expect(ExpressionFunctions.msToTimestamp(999123)).toBe('16:39.1')
			expect(ExpressionFunctions.msToTimestamp(1234567)).toBe('20:34.5')

			expect(ExpressionFunctions.msToTimestamp('9900')).toBe('00:09.9')
			expect(ExpressionFunctions.msToTimestamp(false)).toBe('00:00.0')
			expect(ExpressionFunctions.msToTimestamp(-11)).toBe('00:00.0')

			// TODO - format

			// // hh:mm:ss
			// expect(ExpressionFunctions.msToTimestamp(11, 'hh:mm:ss')).toBe('00:00:11')
			// expect(ExpressionFunctions.msToTimestamp(9999, 'hh:mm:ss')).toBe('02:46:39')
			// expect(ExpressionFunctions.msToTimestamp(1234567, 'hh:mm:ss')).toBe('342:56:07')
		})
	})

	describe('boolean', () => {
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
	})
})
