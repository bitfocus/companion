import { describe, expect, test } from 'vitest'
import { closestShape, linkBitmapSizesFor } from '../../lib/Link/ButtonSizes.js'

describe('linkBitmapSizesFor', () => {
	test('asks for each size it is shown at, once, so that each is drawn at its own resolution', () => {
		expect(
			linkBitmapSizesFor([
				{ width: 72, height: 72 },
				{ width: 96, height: 96 },
				{ width: 72, height: 72 },
				{ width: 200, height: 100 },
			])
		).toEqual([
			{ width: 72, height: 72 },
			{ width: 96, height: 96 },
			{ width: 200, height: 100 },
		])
	})

	test('asks for a size too large for the protocol smaller, keeping its shape', () => {
		expect(linkBitmapSizesFor([{ width: 4096, height: 1024 }])).toEqual([{ width: 2048, height: 512 }])
		// Large enough for a button filling a tablet
		expect(linkBitmapSizesFor([{ width: 2048, height: 1536 }])).toEqual([{ width: 2048, height: 1536 }])
		// A shape too extreme to fit is cut short rather than asked for beyond what the protocol allows
		expect(linkBitmapSizesFor([{ width: 4000, height: 10 }])).toEqual([{ width: 2048, height: 8 }])
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
})
