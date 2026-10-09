import { describe, expect, test } from 'vitest'
import { isFalsey, isTruthy, parseLineParameters, parseStringParamWithBooleanFallback } from '../codec.js'

// ── isFalsey ──────────────────────────────────────────────────────────────────

describe('isFalsey', () => {
	test('returns true for string "false" (case-insensitive)', () => {
		expect(isFalsey('false')).toBe(true)
		expect(isFalsey('FALSE')).toBe(true)
		expect(isFalsey('False')).toBe(true)
	})

	test('returns true for string "0"', () => {
		expect(isFalsey('0')).toBe(true)
	})

	test('returns true for boolean false', () => {
		expect(isFalsey(false)).toBe(true)
	})

	test('returns true for numeric 0', () => {
		expect(isFalsey(0)).toBe(true)
	})

	test('returns true for null and undefined', () => {
		expect(isFalsey(null)).toBe(true)
		expect(isFalsey(undefined)).toBe(true)
	})

	test('returns false for string "true"', () => {
		expect(isFalsey('true')).toBe(false)
	})

	test('returns false for string "1"', () => {
		expect(isFalsey('1')).toBe(false)
	})

	test('returns false for boolean true', () => {
		expect(isFalsey(true)).toBe(false)
	})

	test('returns false for a non-empty non-zero string', () => {
		expect(isFalsey('hello')).toBe(false)
	})
})

// ── isTruthy ──────────────────────────────────────────────────────────────────

describe('isTruthy', () => {
	test('returns true for string "true" (case-insensitive)', () => {
		expect(isTruthy('true')).toBe(true)
		expect(isTruthy('TRUE')).toBe(true)
	})

	test('returns true for string "yes" (case-insensitive)', () => {
		expect(isTruthy('yes')).toBe(true)
		expect(isTruthy('YES')).toBe(true)
	})

	test('returns true for numeric string >= 1', () => {
		expect(isTruthy('1')).toBe(true)
		expect(isTruthy('2')).toBe(true)
	})

	test('returns true for number >= 1', () => {
		expect(isTruthy(1)).toBe(true)
		expect(isTruthy(10)).toBe(true)
	})

	test('returns false for string "false"', () => {
		expect(isTruthy('false')).toBe(false)
	})

	test('returns false for string "0"', () => {
		expect(isTruthy('0')).toBe(false)
	})

	test('returns false for boolean false', () => {
		expect(isTruthy(false)).toBe(false)
	})

	test('returns false for numeric 0', () => {
		expect(isTruthy(0)).toBe(false)
	})

	test('returns false for null and undefined', () => {
		expect(isTruthy(null)).toBe(false)
		expect(isTruthy(undefined)).toBe(false)
	})

	test('returns false for an arbitrary non-numeric string', () => {
		// Not falsey (non-empty), but not "true"/"yes" and Number("hello") is NaN < 1
		expect(isTruthy('hello')).toBe(false)
	})
})

// ── parseLineParameters ───────────────────────────────────────────────────────

describe('parseLineParameters', () => {
	describe('basic key/value parsing', () => {
		test('parses a single key=value pair', () => {
			expect({ ...parseLineParameters('KEY=value') }).toEqual({ KEY: 'value' })
		})

		test('parses multiple space-separated pairs', () => {
			expect({ ...parseLineParameters('A=1 B=2 C=3') }).toEqual({ A: '1', B: '2', C: '3' })
		})

		test('parses an empty value as an empty string', () => {
			expect(parseLineParameters('KEY=').KEY).toBe('')
		})

		test('keeps the value verbatim (no numeric coercion)', () => {
			const params = parseLineParameters('N=42 F=0')
			expect(params.N).toBe('42')
			expect(params.F).toBe('0')
		})
	})

	describe('valueless flags', () => {
		test('treats a token with no `=` as boolean true', () => {
			expect(parseLineParameters('FLAG')).toMatchObject({ FLAG: true })
		})

		test('mixes flags and key/value pairs', () => {
			expect({ ...parseLineParameters('A=1 FLAG B=2') }).toEqual({ A: '1', FLAG: true, B: '2' })
		})
	})

	describe('values containing `=` (only split on the first)', () => {
		test('preserves base64 `=` padding, e.g. a data-url bitmap', () => {
			const value = 'iVBORw0KGgoAAAANSUhEUg=='
			expect(parseLineParameters(`BITMAP=${value}`).BITMAP).toBe(value)
		})

		test('keeps every `=` after the first in the value', () => {
			expect(parseLineParameters('X=a=b=c').X).toBe('a=b=c')
		})
	})

	describe('quoted values', () => {
		test('keeps spaces inside a quoted value and strips the quotes', () => {
			expect(parseLineParameters('TEXT="hello world"').TEXT).toBe('hello world')
		})

		test('does not split on `=` inside a quoted value', () => {
			expect({ ...parseLineParameters('PATH=0/0 X="a=b=c"') }).toEqual({ PATH: '0/0', X: 'a=b=c' })
		})

		test('strips quotes that appear mid-token', () => {
			expect(parseLineParameters('KEY=va"lue"').KEY).toBe('value')
		})

		test('supports a quoted key containing spaces', () => {
			expect(parseLineParameters('"quoted key"=v')['quoted key']).toBe('v')
		})
	})

	describe('backslash escapes', () => {
		test('unescapes a quote inside a quoted value', () => {
			expect(parseLineParameters('KEY="a\\"b"').KEY).toBe('a"b')
		})

		test('unescapes a space so it does not split the token', () => {
			expect(parseLineParameters('KEY=a\\ b').KEY).toBe('a b')
		})

		test('ignores a dangling trailing backslash instead of appending "undefined"', () => {
			expect(parseLineParameters('KEY=a\\').KEY).toBe('a')
			expect(parseLineParameters('FLAG\\')).toMatchObject({ FLAG: true })
		})
	})

	describe('whitespace handling', () => {
		test('does not treat tabs as separators', () => {
			expect(parseLineParameters('A=1\tB=2').A).toBe('1\tB=2')
		})

		test('ignores consecutive spaces (no empty-string key)', () => {
			expect({ ...parseLineParameters('A=1  B=2') }).toEqual({ A: '1', B: '2' })
		})

		test('ignores leading and trailing spaces', () => {
			expect({ ...parseLineParameters('  A=1 B=2  ') }).toEqual({ A: '1', B: '2' })
		})
	})

	describe('prototype-pollution hardening', () => {
		test('returns a prototype-less object', () => {
			expect(Object.getPrototypeOf(parseLineParameters('A=1'))).toBeNull()
		})

		test('drops dangerous keys (__proto__, constructor, prototype, ...)', () => {
			const result = parseLineParameters('__proto__=injected constructor=bad prototype=x __defineGetter__=y normal=ok')
			expect(result).not.toHaveProperty('__proto__')
			expect(result).not.toHaveProperty('constructor')
			expect(result).not.toHaveProperty('prototype')
			expect(result).not.toHaveProperty('__defineGetter__')
			expect(result.normal).toBe('ok')
			expect(Object.prototype).not.toHaveProperty('injected')
		})

		test('drops a dangerous key even when its value contains =', () => {
			const result = parseLineParameters('__proto__=a=b normal=ok')
			expect(result).not.toHaveProperty('__proto__')
			expect(result.normal).toBe('ok')
		})
	})

	describe('edge cases', () => {
		test('maps an empty line to an empty object', () => {
			expect({ ...parseLineParameters('') }).toEqual({})
		})

		test('maps a whitespace-only line to an empty object', () => {
			expect({ ...parseLineParameters('   ') }).toEqual({})
		})
	})

	describe('draw parameters', () => {
		test('extracts a base64 LEDS parameter alongside other params', () => {
			// LEDS is always `segments * 3` bytes; this payload base64-encodes to a value containing `/`
			const leds = Buffer.from([255, 0, 0, 0, 255, 0]).toString('base64')
			expect(leds).toContain('/')

			const params = parseLineParameters(`DEVICEID=abc123 CONTROLID=0/0 LEDS=${leds} PRESSED=1`)

			expect(params).toMatchObject({
				DEVICEID: 'abc123',
				CONTROLID: '0/0',
				LEDS: leds,
				PRESSED: '1',
			})
		})

		test('round-trips a LEDS buffer through base64', () => {
			const original = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9])
			const params = parseLineParameters(`LEDS=${original.toString('base64')}`)

			expect(typeof params.LEDS).toBe('string')
			expect(Buffer.from(params.LEDS as string, 'base64')).toEqual(original)
		})

		test('preserves the base64 `=` padding of a quoted data: url bitmap', () => {
			const dataUrl = 'data:image/png;base64,iVBORw0KGgo='
			expect(parseLineParameters(`BITMAP="${dataUrl}"`).BITMAP).toBe(dataUrl)
		})

		test('parses a realistic KEY-STATE line with mixed value kinds', () => {
			const params = parseLineParameters(
				'DEVICEID=surface-1 KEY=5 COLOR=#ff0000 TEXT="Play Clip" BITMAP=aGVsbG8= PRESSED=0'
			)
			expect(params).toMatchObject({
				DEVICEID: 'surface-1',
				KEY: '5',
				COLOR: '#ff0000',
				TEXT: 'Play Clip',
				BITMAP: 'aGVsbG8=',
				PRESSED: '0',
			})
		})
	})
})

// ── parseStringParamWithBooleanFallback ───────────────────────────────────────

describe('parseStringParamWithBooleanFallback', () => {
	const list = ['fit', 'fill', 'crop'] as const

	test('returns the matching list value when param is in the list', () => {
		expect(parseStringParamWithBooleanFallback([...list], 'fit', 'fill')).toBe('fill')
		expect(parseStringParamWithBooleanFallback([...list], 'fit', 'crop')).toBe('crop')
	})

	test('returns the default value when param is truthy but not in the list', () => {
		expect(parseStringParamWithBooleanFallback([...list], 'fit', 'yes')).toBe('fit')
		expect(parseStringParamWithBooleanFallback([...list], 'fit', '1')).toBe('fit')
		expect(parseStringParamWithBooleanFallback([...list], 'fit', true)).toBe('fit')
	})

	test('returns null when param is falsey', () => {
		expect(parseStringParamWithBooleanFallback([...list], 'fit', 'false')).toBeNull()
		expect(parseStringParamWithBooleanFallback([...list], 'fit', '0')).toBeNull()
		expect(parseStringParamWithBooleanFallback([...list], 'fit', false)).toBeNull()
	})
})
