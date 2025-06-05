import { describe, it, expect } from 'vitest'
import { ExpressionFunctions } from '../Expression/ExpressionFunctions.js'

describe('functions', () => {
	describe('general', () => {
		it('length', () => {
			expect(ExpressionFunctions.length()).toBe(0)
			expect(ExpressionFunctions.length('')).toBe(0)
			expect(ExpressionFunctions.length('a')).toBe(1)
			expect(ExpressionFunctions.length('abc')).toBe(3)
			expect(ExpressionFunctions.length('ä')).toBe(1) // codepoint U+00E4, one grapheme
			expect(ExpressionFunctions.length('̈a')).toBe(2) // codepoints U+0308 U+0061, one grapheme, wrong order
			expect(ExpressionFunctions.length('ä')).toBe(1) // codepoints U+0061 U+0308, one grapheme
			expect(ExpressionFunctions.length('á̈')).toBe(1) // codepoints U+0061 U+0301 U+0308, one grapheme
			expect(ExpressionFunctions.length(9)).toBe(1)
			expect(ExpressionFunctions.length(99)).toBe(2)
			expect(ExpressionFunctions.length(-123)).toBe(4)
			expect(ExpressionFunctions.length(3.14)).toBe(4)
			expect(ExpressionFunctions.length(BigInt(1024))).toBe(4)
			expect(ExpressionFunctions.length(BigInt(9007199254740991))).toBe(16)
			expect(ExpressionFunctions.length(new RegExp('ab+c', 'i'))).toBe(7)
			expect(ExpressionFunctions.length([])).toBe(0)
			expect(ExpressionFunctions.length([9])).toBe(1)
			expect(ExpressionFunctions.length([99])).toBe(1)
			expect(ExpressionFunctions.length(['abc'])).toBe(1)
			expect(ExpressionFunctions.length([9, 'a'])).toBe(2)
			expect(ExpressionFunctions.length(['a', 'c'])).toBe(2)
			expect(ExpressionFunctions.length(['ab', ''])).toBe(2)
			// eslint-disable-next-line no-sparse-arrays
			expect(ExpressionFunctions.length([1, , 3])).toBe(3)
			expect(ExpressionFunctions.length(['a', 'b', 'c'])).toBe(3)
			expect(ExpressionFunctions.length(['a', ['b', 'b'], 'c'])).toBe(3)
			expect(ExpressionFunctions.length({ a: 1 })).toBe(1)
			expect(ExpressionFunctions.length({ a: 1, b: { c: 5 } })).toBe(2)
			expect(ExpressionFunctions.length({ a: ['a', 'c'], b: { c: 5 } })).toBe(2)
		})
	})

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
			expect(ExpressionFunctions.strlen('ä')).toBe(2) // codepoints U+0061 U+0308, one grapheme, two bytes
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
			expect(ExpressionFunctions.substr('ä', 0, 1)).toBe('a') // codepoints U+0061 U+0308, one grapheme, substr works on bytes

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

		it('split', () => {
			expect(ExpressionFunctions.split()).toEqual(['undefined'])
			expect(ExpressionFunctions.split(9, 'a')).toEqual(['9'])
			expect(ExpressionFunctions.split('abc', 'b')).toEqual(['a', 'c'])
			expect(ExpressionFunctions.split('abc', 'c')).toEqual(['ab', ''])
		})

		it('join', () => {
			expect(ExpressionFunctions.join()).toBe('')
			expect(ExpressionFunctions.join('')).toBe('')
			expect(ExpressionFunctions.join(9)).toBe('9')
			expect(ExpressionFunctions.join([])).toBe('')
			expect(ExpressionFunctions.join([9])).toBe('9')
			expect(ExpressionFunctions.join([9], 'a')).toBe('9')
			expect(ExpressionFunctions.join([9, 'a'])).toBe('9,a')
			expect(ExpressionFunctions.join([9, 'b'], 'a')).toBe('9ab')
			expect(ExpressionFunctions.join(['a', 'c'])).toBe('a,c')
			expect(ExpressionFunctions.join(['a', 'c'], 'b')).toBe('abc')
			expect(ExpressionFunctions.join(['a', 'c'], 'cademi')).toBe('academic')
			expect(ExpressionFunctions.join(['ab', ''])).toBe('ab,')
			expect(ExpressionFunctions.join(['ab', ''], 'c')).toBe('abc')
			expect(ExpressionFunctions.join(['a', 'b', 'c'])).toBe('a,b,c')
			expect(ExpressionFunctions.join(['a', 'b', 'c'], '-')).toBe('a-b-c')
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
			expect(ExpressionFunctions.indexOf('1234512345', '34', 2)).toBe(2)
			expect(ExpressionFunctions.indexOf('1234512345', '34', 3)).toBe(7)
			expect(ExpressionFunctions.indexOf('ä', 'a')).toBe(0) // codepoints U+0061 U+0308, one grapheme, indexOf works on bytes
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
			expect(ExpressionFunctions.lastIndexOf('1234512345', '34', 7)).toBe(7)
			expect(ExpressionFunctions.lastIndexOf('1234512345', '34', 6)).toBe(2)
			expect(ExpressionFunctions.lastIndexOf('äbbä', 'a')).toBe(4) // codepoints U+0061 U+0308, one grapheme, lastIndexOf works on bytes
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

		it('decode', () => {
			expect(ExpressionFunctions.decode('4b455933', 'hex')).toBe('KEY3')
			expect(ExpressionFunctions.decode('66617578', 'hex')).toBe('faux')
			expect(ExpressionFunctions.decode('436f6d70616e696f6e', 'hex')).toBe('Companion')
			expect(ExpressionFunctions.decode('3c54455354233e0a0d', 'hex')).toBe('<TEST#>' + String.fromCharCode(0x0a, 0x0d))
			expect(ExpressionFunctions.decode('Q29tcGFuaW9u', 'base64')).toBe('Companion')
			expect(ExpressionFunctions.decode('Companion')).toBe('Companion')
		})

		it('encode', () => {
			expect(ExpressionFunctions.encode('KEY3', 'hex')).toBe('4b455933')
			expect(ExpressionFunctions.encode('faux', 'hex')).toBe('66617578')
			expect(ExpressionFunctions.encode('Companion', 'hex')).toBe('436f6d70616e696f6e')
			expect(ExpressionFunctions.encode('<TEST#>' + String.fromCharCode(0x0a, 0x0d), 'hex')).toBe('3c54455354233e0a0d')
			expect(ExpressionFunctions.encode('Companion', 'base64')).toBe('Q29tcGFuaW9u')
			expect(ExpressionFunctions.encode('Companion')).toBe('Companion')
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

	describe('object/array', () => {
		it('jsonpath', () => {
			const obj = {
				a: 1,
				b: {
					c: 5,
				},
			}

			expect(ExpressionFunctions.jsonpath(obj, '$.b')).toEqual({ c: 5 })
			expect(ExpressionFunctions.jsonpath(obj, '$.c')).toEqual(undefined)
			expect(ExpressionFunctions.jsonpath(obj, '$.b.c')).toEqual(5)
			expect(ExpressionFunctions.jsonpath(obj, '$')).toEqual(obj)

			expect(ExpressionFunctions.jsonpath(undefined, '$.c')).toEqual(undefined)

			const objStr = JSON.stringify(obj)
			expect(ExpressionFunctions.jsonpath(objStr, '$.b')).toEqual('{"c":5}')
			expect(ExpressionFunctions.jsonpath(objStr, '$.c')).toEqual(undefined)
			expect(ExpressionFunctions.jsonpath(objStr, '$.b.c')).toEqual(5)
			expect(ExpressionFunctions.jsonpath(objStr, '$')).toEqual(JSON.stringify(obj))

			const obj2 = [{ name: 'Default' }, { name: 'Second' }]
			expect(ExpressionFunctions.jsonpath(obj2, '$[0]')).toEqual({ name: 'Default' })
			expect(ExpressionFunctions.jsonpath(JSON.stringify(obj2), '$[0]')).toEqual('{"name":"Default"}')

			expect(ExpressionFunctions.jsonpath('Test', '$')).toEqual('Test')
			expect(ExpressionFunctions.jsonpath({}, '$')).toEqual({})
		})

		it('jsonparse', () => {
			expect(ExpressionFunctions.jsonparse('')).toEqual(null)
			expect(ExpressionFunctions.jsonparse('{}')).toEqual({})
			expect(ExpressionFunctions.jsonparse('1')).toEqual(1)
			expect(ExpressionFunctions.jsonparse(1)).toEqual(1)
			expect(ExpressionFunctions.jsonparse(null)).toEqual(null)

			expect(ExpressionFunctions.jsonparse('{a: 1}')).toEqual(null)
			expect(ExpressionFunctions.jsonparse('{"a": 1}')).toEqual({ a: 1 })
			expect(ExpressionFunctions.jsonparse('{"a": 1')).toEqual(null)
		})

		it('jsonstringify', () => {
			expect(ExpressionFunctions.jsonstringify('')).toEqual('""')
			expect(ExpressionFunctions.jsonstringify(1)).toEqual('1')
			expect(ExpressionFunctions.jsonstringify({})).toEqual('{}')
			expect(ExpressionFunctions.jsonstringify(null)).toEqual('null')
			expect(ExpressionFunctions.jsonstringify(undefined)).toEqual(undefined)

			expect(ExpressionFunctions.jsonstringify({ a: 1 })).toEqual('{"a":1}')
			expect(ExpressionFunctions.jsonstringify([1, 2, 3])).toEqual('[1,2,3]')
		})

		it('arrayIncludes', () => {
			// Test with valid arrays and values
			expect(ExpressionFunctions.arrayIncludes([1, 2, 3], 2)).toBe(true)
			expect(ExpressionFunctions.arrayIncludes([1, 2, 3], 4)).toBe(false)
			expect(ExpressionFunctions.arrayIncludes(['a', 'b', 'c'], 'b')).toBe(true)
			expect(ExpressionFunctions.arrayIncludes(['a', 'b', 'c'], 'd')).toBe(false)

			// Test with mixed types
			expect(ExpressionFunctions.arrayIncludes([1, 'hello', true, null], 'hello')).toBe(true)
			expect(ExpressionFunctions.arrayIncludes([1, 'hello', true, null], true)).toBe(true)
			expect(ExpressionFunctions.arrayIncludes([1, 'hello', true, null], null)).toBe(true)
			expect(ExpressionFunctions.arrayIncludes([1, 'hello', true, null], false)).toBe(false)

			// Test with empty array
			expect(ExpressionFunctions.arrayIncludes([], 'anything')).toBe(false)
			expect(ExpressionFunctions.arrayIncludes([], null)).toBe(false)
			expect(ExpressionFunctions.arrayIncludes([], undefined)).toBe(false)

			// Test with non-array inputs (should return false)
			expect(ExpressionFunctions.arrayIncludes(null, 'test')).toBe(false)
			expect(ExpressionFunctions.arrayIncludes(undefined, 'test')).toBe(false)
			expect(ExpressionFunctions.arrayIncludes('not an array', 'test')).toBe(false)
			expect(ExpressionFunctions.arrayIncludes(123, 'test')).toBe(false)
			expect(ExpressionFunctions.arrayIncludes({}, 'test')).toBe(false)
			expect(ExpressionFunctions.arrayIncludes({ length: 3 }, 'test')).toBe(false) // Array-like object

			// Test with nested arrays and objects
			const nestedArray = [
				[1, 2],
				[3, 4],
			]
			expect(ExpressionFunctions.arrayIncludes(nestedArray, [1, 2])).toBe(false) // Reference equality
			expect(ExpressionFunctions.arrayIncludes([{ a: 1 }, { b: 2 }], { a: 1 })).toBe(false) // Reference equality

			// Test with undefined/null values in array
			expect(ExpressionFunctions.arrayIncludes([undefined, null, 0, ''], undefined)).toBe(true)
			expect(ExpressionFunctions.arrayIncludes([undefined, null, 0, ''], null)).toBe(true)
			expect(ExpressionFunctions.arrayIncludes([undefined, null, 0, ''], 0)).toBe(true)
			expect(ExpressionFunctions.arrayIncludes([undefined, null, 0, ''], '')).toBe(true)

			// Test strict equality (no type coercion)
			expect(ExpressionFunctions.arrayIncludes([1, 2, 3], '2')).toBe(false) // Number vs string
			expect(ExpressionFunctions.arrayIncludes(['1', '2', '3'], 2)).toBe(false) // String vs number
			expect(ExpressionFunctions.arrayIncludes([true, false], 1)).toBe(false) // Boolean vs number
			expect(ExpressionFunctions.arrayIncludes([true, false], 'true')).toBe(false) // Boolean vs string
		})
	})

	describe('time', () => {
		it('unixNow', () => {
			const value = ExpressionFunctions.unixNow()
			expect(value / 10).toBeCloseTo(Date.now() / 10, 0)
		})

		it('secondsToTimestamp', () => {
			expect(ExpressionFunctions.secondsToTimestamp(11)).toBe('00:00:11')
			expect(ExpressionFunctions.secondsToTimestamp(999)).toBe('00:16:39')
			expect(ExpressionFunctions.secondsToTimestamp(9999)).toBe('02:46:39')
			expect(ExpressionFunctions.secondsToTimestamp(1234567)).toBe('342:56:07')

			expect(ExpressionFunctions.secondsToTimestamp('99')).toBe('00:01:39')
			expect(ExpressionFunctions.secondsToTimestamp(false)).toBe('00:00:00')
			expect(ExpressionFunctions.secondsToTimestamp(-11)).toBe('-00:00:11')

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

		it('timestampToSeconds', () => {
			expect(ExpressionFunctions.timestampToSeconds('00:00:11')).toBe(11)
			expect(ExpressionFunctions.timestampToSeconds('00:16:39')).toBe(999)
			expect(ExpressionFunctions.timestampToSeconds('02:46:39')).toBe(9999)
			expect(ExpressionFunctions.timestampToSeconds('342:56:07')).toBe(1234567)

			expect(ExpressionFunctions.timestampToSeconds('00:00_11')).toBe(0)
			expect(ExpressionFunctions.timestampToSeconds(false)).toBe(0)
			expect(ExpressionFunctions.timestampToSeconds(99)).toBe(0)
		})

		it('msToTimestamp', () => {
			expect(ExpressionFunctions.msToTimestamp(1100)).toBe('00:01.1')
			expect(ExpressionFunctions.msToTimestamp(999123)).toBe('16:39.1')
			expect(ExpressionFunctions.msToTimestamp(1234567)).toBe('20:34.5')

			expect(ExpressionFunctions.msToTimestamp('9900')).toBe('00:09.9')
			expect(ExpressionFunctions.msToTimestamp(false)).toBe('00:00.0')
			expect(ExpressionFunctions.msToTimestamp(-11)).toBe('00:00.0')

			expect(ExpressionFunctions.msToTimestamp(11000, 'hh:mm:ss')).toBe('00:00:11')
			expect(ExpressionFunctions.msToTimestamp(9999000, 'hh:mm:ss')).toBe('02:46:39')
			expect(ExpressionFunctions.msToTimestamp(1234567890, 'hh:mm:ss')).toBe('342:56:07')

			expect(ExpressionFunctions.msToTimestamp(11000, 'hh:mm')).toBe('00:00')
			expect(ExpressionFunctions.msToTimestamp(9999000, 'hh:mm')).toBe('02:46')
			expect(ExpressionFunctions.msToTimestamp(1234567890, 'hh:mm')).toBe('342:56')
		})

		it('timeOffset', () => {
			expect(ExpressionFunctions.timeOffset('15:00:00', +5)).toBe('20:00:00')
			expect(ExpressionFunctions.timeOffset('15:00:00', -5)).toBe('10:00:00')
			expect(ExpressionFunctions.timeOffset('15:00:00', '-02:00:00', true)).toBe('01:00:00')
			expect(ExpressionFunctions.timeOffset('15:00', -5)).toBe('10:00')
		})

		it('timeDiff', () => {
			expect(ExpressionFunctions.timeDiff('2024-05-23T12:00Z', '2024-05-23T18:00-04:00')).toBe(36000)
			expect(ExpressionFunctions.timeDiff('12:00', '18:00')).toBe(21600)
		})
	})
})
