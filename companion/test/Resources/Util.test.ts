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
	transformButtonImage,
	translateRotation,
	uint8ArrayToBuffer,
} from '../../lib/Resources/Util.js'

/** Build a solid width×height straight-alpha RGBA buffer. */
function solidRgba(width: number, height: number, r: number, g: number, b: number, a: number): Buffer {
	const buf = Buffer.alloc(width * height * 4)
	for (let i = 0; i < buf.length; i += 4) {
		buf[i] = r
		buf[i + 1] = g
		buf[i + 2] = b
		buf[i + 3] = a
	}
	return buf
}

/** Build a width×height RGBA buffer from row-major [r,g,b,a] pixels. */
function rgbaFromPixels(width: number, height: number, pixels: Array<[number, number, number, number]>): Buffer {
	const buf = Buffer.alloc(width * height * 4)
	pixels.forEach(([r, g, b, a], p) => {
		buf[p * 4] = r
		buf[p * 4 + 1] = g
		buf[p * 4 + 2] = b
		buf[p * 4 + 3] = a
	})
	return buf
}

/** Read the channels of pixel (x,y) from a packed output buffer. */
function pixelAt(buf: Buffer, width: number, channels: number, x: number, y: number): number[] {
	const i = (y * width + x) * channels
	return Array.from(buf.subarray(i, i + channels))
}

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

// ── transformButtonImage ────────────────────────────────────────────────────────

describe('transformButtonImage', () => {
	describe('pixel format & alpha', () => {
		// A 50% pixel: straight alpha keeps RGB at full, premultiplied-over-black halves it.
		test('rgb output flattens straight alpha over black', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 255, 0, 0, 128), 2, 2, null, 2, 2, 'rgb')
			expect(out.length).toBe(2 * 2 * 3)
			expect(pixelAt(out, 2, 3, 0, 0)).toEqual([128, 0, 0])
		})

		test('rgba output preserves straight alpha (transparency is kept)', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 255, 0, 0, 128), 2, 2, null, 2, 2, 'rgba')
			expect(out.length).toBe(2 * 2 * 4)
			expect(pixelAt(out, 2, 4, 0, 0)).toEqual([255, 0, 0, 128])
		})

		test('bgr output flattens over black and swaps channel order', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 255, 0, 0, 128), 2, 2, null, 2, 2, 'bgr')
			expect(pixelAt(out, 2, 3, 0, 0)).toEqual([0, 0, 128]) // B, G, R
		})

		test('bgra output swaps channel order and preserves alpha', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 255, 0, 0, 128), 2, 2, null, 2, 2, 'bgra')
			expect(pixelAt(out, 2, 4, 0, 0)).toEqual([0, 0, 255, 128]) // B, G, R, A
		})

		test('opaque pixels are unchanged in rgb', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 10, 20, 30, 255), 2, 2, null, 2, 2, 'rgb')
			expect(pixelAt(out, 2, 3, 0, 0)).toEqual([10, 20, 30])
		})

		test('fully transparent pixels become black in rgb', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 255, 0, 0, 0), 2, 2, null, 2, 2, 'rgb')
			expect(pixelAt(out, 2, 3, 0, 0)).toEqual([0, 0, 0])
		})

		test('a mid-alpha colour is flattened proportionally', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 255, 128, 0, 128), 2, 2, null, 2, 2, 'rgb')
			const [r, g, b] = pixelAt(out, 2, 3, 0, 0)
			// (255,128,0) * 128/255 ≈ (128, 64, 0)
			expect(r).toBeGreaterThanOrEqual(127)
			expect(r).toBeLessThanOrEqual(129)
			expect(g).toBeGreaterThanOrEqual(63)
			expect(g).toBeLessThanOrEqual(65)
			expect(b).toBe(0)
		})
	})

	describe('scaling', () => {
		test('upscales a solid colour to the target size', async () => {
			const out = await transformButtonImage(solidRgba(1, 1, 255, 0, 0, 255), 1, 1, null, 4, 4, 'rgb')
			expect(out.length).toBe(4 * 4 * 3)
			expect(pixelAt(out, 4, 3, 0, 0)).toEqual([255, 0, 0])
			expect(pixelAt(out, 4, 3, 3, 3)).toEqual([255, 0, 0])
		})

		test('downscales a solid colour to the target size', async () => {
			const out = await transformButtonImage(solidRgba(4, 4, 0, 255, 0, 255), 4, 4, null, 2, 2, 'rgb')
			expect(out.length).toBe(2 * 2 * 3)
			expect(pixelAt(out, 2, 3, 0, 0)).toEqual([0, 255, 0])
		})

		test('always outputs targetWidth×targetHeight regardless of input size', async () => {
			const out = await transformButtonImage(solidRgba(3, 3, 1, 2, 3, 255), 3, 3, null, 5, 7, 'rgb')
			expect(out.length).toBe(5 * 7 * 3)
		})
	})

	describe('letterbox padding', () => {
		test('pads a square render into a wider target with black bars', async () => {
			// 'Fit' keeps the 2×2 square (limited by height 2), centred in the 4×2 target → 1px black bar each side
			const out = await transformButtonImage(solidRgba(2, 2, 255, 0, 0, 255), 2, 2, null, 4, 2, 'rgb')
			expect(pixelAt(out, 4, 3, 0, 0)).toEqual([0, 0, 0]) // left bar
			expect(pixelAt(out, 4, 3, 1, 0)).toEqual([255, 0, 0]) // content
			expect(pixelAt(out, 4, 3, 3, 0)).toEqual([0, 0, 0]) // right bar
		})

		test('letterbox padding is opaque black even in rgba', async () => {
			const out = await transformButtonImage(solidRgba(2, 2, 255, 0, 0, 255), 2, 2, null, 4, 2, 'rgba')
			expect(pixelAt(out, 4, 4, 0, 0)).toEqual([0, 0, 0, 255])
		})
	})

	describe('rotation', () => {
		// Four distinct opaque pixels, row-major: (0,0)=A (1,0)=B / (0,1)=C (1,1)=D
		const A: [number, number, number, number] = [10, 0, 0, 255]
		const B: [number, number, number, number] = [0, 20, 0, 255]
		const C: [number, number, number, number] = [0, 0, 30, 255]
		const D: [number, number, number, number] = [40, 40, 40, 255]
		const grid = () => rgbaFromPixels(2, 2, [A, B, C, D])
		const rgb3 = (p: [number, number, number, number]) => [p[0], p[1], p[2]]

		test('no rotation leaves the image as-is', async () => {
			const out = await transformButtonImage(grid(), 2, 2, null, 2, 2, 'rgb')
			expect(pixelAt(out, 2, 3, 0, 0)).toEqual(rgb3(A))
			expect(pixelAt(out, 2, 3, 1, 1)).toEqual(rgb3(D))
		})

		test('180 rotates the image', async () => {
			const out = await transformButtonImage(grid(), 2, 2, 180, 2, 2, 'rgb')
			expect(pixelAt(out, 2, 3, 0, 0)).toEqual(rgb3(D))
			expect(pixelAt(out, 2, 3, 1, 0)).toEqual(rgb3(C))
			expect(pixelAt(out, 2, 3, 0, 1)).toEqual(rgb3(B))
			expect(pixelAt(out, 2, 3, 1, 1)).toEqual(rgb3(A))
		})

		test('90 and -90 rotate in opposite directions', async () => {
			const cw = await transformButtonImage(grid(), 2, 2, 90, 2, 2, 'rgb')
			const ccw = await transformButtonImage(grid(), 2, 2, -90, 2, 2, 'rgb')
			// top-left of the two must differ (opposite rotations), and neither equals the un-rotated A
			expect(pixelAt(cw, 2, 3, 0, 0)).not.toEqual(pixelAt(ccw, 2, 3, 0, 0))
			expect(pixelAt(cw, 2, 3, 0, 0)).not.toEqual(rgb3(A))
		})
	})
})
