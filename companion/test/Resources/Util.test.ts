import { describe, expect, test } from 'vitest'
import {
	argb,
	clamp,
	convert2Digit,
	decimalToRgb,
	isFalsey,
	isTruthy,
	lazy,
	parseColorToNumber,
	parseLineParameters,
	parseStringParamWithBooleanFallback,
	rgb,
	rotateResolution,
	translateRotation,
	uint8ArrayToBuffer,
} from '../../lib/Resources/Util.js'

// ── rgb ───────────────────────────────────────────────────────────────────────

describe('rgb', () => {
	test('combines r, g, b into a 24-bit number', () => {
		expect(rgb(255, 0, 0)).toBe(0xff0000)
		expect(rgb(0, 255, 0)).toBe(0x00ff00)
		expect(rgb(0, 0, 255)).toBe(0x0000ff)
		expect(rgb(0, 0, 0)).toBe(0x000000)
		expect(rgb(255, 255, 255)).toBe(0xffffff)
	})

	test('accepts string digits', () => {
		expect(rgb('255', '128', '0')).toBe(0xff8000)
	})

	test('accepts a custom base for hex strings', () => {
		expect(rgb('ff', '80', '00', 16)).toBe(0xff8000)
	})

	test('returns false when any component is NaN', () => {
		expect(rgb(NaN, 0, 0)).toBe(false)
		expect(rgb(0, NaN, 0)).toBe(false)
		expect(rgb(0, 0, NaN)).toBe(false)
		expect(rgb('x', 0, 0)).toBe(false)
	})

	test('masks each channel to 8 bits', () => {
		// 256 & 0xff === 0, so rgb(256, 0, 1) === 0x000001
		expect(rgb(256, 0, 1)).toBe(0x000001)
	})
})

// ── argb ──────────────────────────────────────────────────────────────────────

describe('argb', () => {
	test('a=255 (fully transparent) contributes no alpha offset', () => {
		// (255 - 255) * 0x1000000 + rgb(r,g,b) === rgb(r,g,b)
		const expected = rgb(255, 0, 0) as number
		expect(argb(255, 255, 0, 0)).toBe(expected)
	})

	test('a=0 (fully opaque) adds 255 * 0x1000000 to the rgb value', () => {
		expect(argb(0, 0, 0, 0)).toBe(255 * 0x1000000)
	})

	test('returns false when alpha is NaN', () => {
		expect(argb('x', 0, 0, 0)).toBe(false)
	})

	test('returns false when an rgb component is invalid', () => {
		expect(argb(0, 'x', 0, 0)).toBe(false)
	})

	test('accepts hex strings with base 16', () => {
		expect(argb('00', 'ff', '00', '00', 16)).toBe(argb(0, 255, 0, 0))
	})
})

// ── decimalToRgb ──────────────────────────────────────────────────────────────

describe('decimalToRgb', () => {
	test('extracts red, green, blue from a 24-bit number', () => {
		expect(decimalToRgb(0xff8040)).toEqual({ red: 0xff, green: 0x80, blue: 0x40 })
	})

	test('black is all zeros', () => {
		expect(decimalToRgb(0)).toEqual({ red: 0, green: 0, blue: 0 })
	})

	test('white is all 255', () => {
		expect(decimalToRgb(0xffffff)).toEqual({ red: 255, green: 255, blue: 255 })
	})

	test('pure red', () => {
		expect(decimalToRgb(0xff0000)).toEqual({ red: 255, green: 0, blue: 0 })
	})
})

// ── parseColorToNumber ────────────────────────────────────────────────────────

describe('parseColorToNumber', () => {
	test('parses a hex CSS color string', () => {
		expect(parseColorToNumber('#00ff00')).toBe(rgb(0, 255, 0))
		expect(parseColorToNumber('#ff0000')).toBe(rgb(255, 0, 0))
		expect(parseColorToNumber('#0000ff')).toBe(rgb(0, 0, 255))
	})

	test('parses an rgb() CSS color string', () => {
		expect(parseColorToNumber('rgb(255,0,0)')).toBe(rgb(255, 0, 0))
	})

	test('returns false for an invalid color string', () => {
		expect(parseColorToNumber('notacolor')).toBe(false)
	})

	test('returns false for a plain named CSS color (colord requires names plugin)', () => {
		expect(parseColorToNumber('red')).toBe(false)
	})

	test('passes a number through unchanged', () => {
		expect(parseColorToNumber(0xabcdef)).toBe(0xabcdef)
		expect(parseColorToNumber(0)).toBe(0)
	})

	test('returns false for a Uint8Array', () => {
		expect(parseColorToNumber(new Uint8Array([255, 0, 0]))).toBe(false)
	})
})

// ── convert2Digit ─────────────────────────────────────────────────────────────

describe('convert2Digit', () => {
	test('pads single-digit numbers with a leading zero', () => {
		expect(convert2Digit(0)).toBe('00')
		expect(convert2Digit(5)).toBe('05')
		expect(convert2Digit(9)).toBe('09')
	})

	test('does not pad two-or-more digit numbers', () => {
		expect(convert2Digit(10)).toBe('10')
		expect(convert2Digit(99)).toBe('99')
		expect(convert2Digit(100)).toBe('100')
	})
})

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
	test('parses a simple key=value pair', () => {
		expect(parseLineParameters('key=value')).toEqual({ key: 'value' })
	})

	test('parses a bare key (no value) as true', () => {
		expect(parseLineParameters('FLAG')).toEqual({ FLAG: true })
	})

	test('parses multiple space-separated parameters', () => {
		expect(parseLineParameters('a=1 b=2 c=3')).toEqual({ a: '1', b: '2', c: '3' })
	})

	test('parses mixed bare keys and key=value pairs', () => {
		expect(parseLineParameters('VERBOSE key=val')).toEqual({ VERBOSE: true, key: 'val' })
	})

	test('handles quoted values with spaces', () => {
		expect(parseLineParameters('msg="hello world"')).toEqual({ msg: 'hello world' })
	})

	test('handles escaped quote inside a quoted value', () => {
		expect(parseLineParameters('msg="say \\"hi\\""')).toEqual({ msg: 'say "hi"' })
	})

	test('handles escaped space outside quotes', () => {
		expect(parseLineParameters('key=hello\\ world')).toEqual({ key: 'hello world' })
	})

	test('filters out BANNED_PROPS keys', () => {
		const result = parseLineParameters('__proto__=injected constructor=bad normal=ok')
		expect(result).not.toHaveProperty('__proto__')
		expect(result).not.toHaveProperty('constructor')
		expect(result.normal).toBe('ok')
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

// ── clamp ─────────────────────────────────────────────────────────────────────

describe('clamp', () => {
	test('returns the value when within range', () => {
		expect(clamp(5, 0, 10)).toBe(5)
		expect(clamp(0, 0, 10)).toBe(0)
		expect(clamp(10, 0, 10)).toBe(10)
	})

	test('returns min when value is below range', () => {
		expect(clamp(-5, 0, 10)).toBe(0)
	})

	test('returns max when value is above range', () => {
		expect(clamp(15, 0, 10)).toBe(10)
	})
})

// ── translateRotation ─────────────────────────────────────────────────────────

describe('translateRotation', () => {
	test('90 and "surface90" map to CW270', () => {
		expect(translateRotation(90)).toBe('CW270')
		expect(translateRotation('surface90')).toBe('CW270')
	})

	test('-90 and "surface-90" map to CW90', () => {
		expect(translateRotation(-90)).toBe('CW90')
		expect(translateRotation('surface-90')).toBe('CW90')
	})

	test('180 and "surface180" map to CW180', () => {
		expect(translateRotation(180)).toBe('CW180')
		expect(translateRotation('surface180')).toBe('CW180')
	})

	test('null returns null', () => {
		expect(translateRotation(null)).toBeNull()
	})

	test('0 and "surface0" return null (no rotation)', () => {
		expect(translateRotation(0)).toBeNull()
		expect(translateRotation('surface0')).toBeNull()
	})
})

// ── rotateResolution ──────────────────────────────────────────────────────────

describe('rotateResolution', () => {
	test('swaps width and height for 90° rotation', () => {
		expect(rotateResolution(100, 50, 90)).toEqual([50, 100])
		expect(rotateResolution(100, 50, 'surface90')).toEqual([50, 100])
	})

	test('swaps width and height for -90° rotation', () => {
		expect(rotateResolution(100, 50, -90)).toEqual([50, 100])
		expect(rotateResolution(100, 50, 'surface-90')).toEqual([50, 100])
	})

	test('preserves width and height for 180° rotation', () => {
		expect(rotateResolution(100, 50, 180)).toEqual([100, 50])
		expect(rotateResolution(100, 50, 'surface180')).toEqual([100, 50])
	})

	test('preserves width and height for null (no rotation)', () => {
		expect(rotateResolution(100, 50, null)).toEqual([100, 50])
	})

	test('preserves width and height for 0 rotation', () => {
		expect(rotateResolution(100, 50, 0)).toEqual([100, 50])
	})
})

// ── uint8ArrayToBuffer ────────────────────────────────────────────────────────

describe('uint8ArrayToBuffer', () => {
	test('converts a Uint8Array to a Buffer with the same bytes', () => {
		const arr = new Uint8Array([1, 2, 3, 255])
		const buf = uint8ArrayToBuffer(arr)
		expect(Buffer.isBuffer(buf)).toBe(true)
		expect([...buf]).toEqual([1, 2, 3, 255])
	})

	test('handles an empty array', () => {
		const buf = uint8ArrayToBuffer(new Uint8Array([]))
		expect(buf.length).toBe(0)
	})

	test('handles a Uint8ClampedArray', () => {
		const arr = new Uint8ClampedArray([10, 20, 30])
		const buf = uint8ArrayToBuffer(arr)
		expect([...buf]).toEqual([10, 20, 30])
	})
})

// ── lazy ──────────────────────────────────────────────────────────────────────

describe('lazy', () => {
	test('calls the factory exactly once regardless of how many times the getter is called', () => {
		let calls = 0
		const get = lazy(() => {
			calls++
			return 42
		})
		expect(get()).toBe(42)
		expect(get()).toBe(42)
		expect(get()).toBe(42)
		expect(calls).toBe(1)
	})

	test('returns the same object reference on every call', () => {
		const obj = { x: 1 }
		const get = lazy(() => obj)
		expect(get()).toBe(obj)
		expect(get()).toBe(obj)
	})
})
