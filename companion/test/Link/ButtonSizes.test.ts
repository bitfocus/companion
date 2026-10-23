import { describe, expect, test } from 'vitest'
import { closestShape, isSameShape, linkBitmapSizesFor } from '../../lib/Link/ButtonSizes.js'

describe('linkBitmapSizesFor', () => {
	test('asks for each shape once, at the largest size it is shown at', () => {
		expect(
			linkBitmapSizesFor([
				{ width: 72, height: 72 },
				{ width: 200, height: 200 },
				{ width: 96, height: 96 },
				{ width: 200, height: 100 },
			])
		).toEqual([
			{ width: 200, height: 200 },
			{ width: 288, height: 144 },
		])
	})

	test('treats nearly the same shape as the same', () => {
		expect(
			linkBitmapSizesFor([
				{ width: 120, height: 120 },
				{ width: 119, height: 120 },
			])
		).toEqual([{ width: 144, height: 144 }])
	})

	test('scales small sizes up and large ones down, keeping their shape', () => {
		expect(linkBitmapSizesFor([{ width: 50, height: 25 }])).toEqual([{ width: 288, height: 144 }])
		expect(linkBitmapSizesFor([{ width: 4096, height: 1024 }])).toEqual([{ width: 2048, height: 512 }])
		// Large enough for a button filling a tablet
		expect(linkBitmapSizesFor([{ width: 2048, height: 1536 }])).toEqual([{ width: 2048, height: 1536 }])
		// A shape too extreme to fit is cut short rather than asked for beyond what the protocol allows
		expect(linkBitmapSizesFor([{ width: 800, height: 10 }])).toEqual([{ width: 2048, height: 26 }])
	})

	test('nothing shown, nothing asked for', () => {
		expect(linkBitmapSizesFor([])).toEqual([])
		expect(linkBitmapSizesFor([{ width: 0, height: 72 }])).toEqual([])
		expect(linkBitmapSizesFor([{ width: Number.NaN, height: 72 }])).toEqual([])
	})
})

describe('closestShape', () => {
	test('picks the closest in shape, whatever the size', () => {
		const square = { width: 144, height: 144 }
		const wide = { width: 288, height: 144 }
		const tall = { width: 144, height: 288 }

		expect(closestShape([square, wide, tall], { width: 400, height: 210 })).toBe(wide)
		expect(closestShape([square, wide], { width: 50, height: 90 })).toBe(square)
		expect(closestShape([], square)).toBeUndefined()
	})

	test('isSameShape allows a little difference', () => {
		expect(isSameShape({ width: 72, height: 72 }, { width: 144, height: 144 })).toBe(true)
		expect(isSameShape({ width: 72, height: 72 }, { width: 74, height: 72 })).toBe(true)
		expect(isSameShape({ width: 72, height: 72 }, { width: 80, height: 72 })).toBe(false)
	})
})
