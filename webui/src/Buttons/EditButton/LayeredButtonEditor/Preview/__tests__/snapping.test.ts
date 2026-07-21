import { describe, expect, test } from 'vitest'
import type { ElementRect, PixelRect } from '../elementHitTest.js'
import { collectSnapTargets, SNAP_THRESHOLD_PX, snapAxis, thresholdFractionFor } from '../snapping.js'

const CONTENT: PixelRect = { x: 10, y: 20, width: 100, height: 100 }

function rect(id: string, x: number, y: number, width: number, height: number, isTopLevel = true): ElementRect {
	return { id, rect: { x, y, width, height }, isTopLevel }
}

describe('thresholdFractionFor', () => {
	test('converts the pixel threshold into a fraction of the axis extent', () => {
		expect(thresholdFractionFor(100)).toBe(SNAP_THRESHOLD_PX / 100)
	})

	test('returns 0 for a degenerate extent rather than dividing by zero', () => {
		expect(thresholdFractionFor(0)).toBe(0)
	})
})

describe('collectSnapTargets', () => {
	test('always offers the content edges and centre', () => {
		expect(collectSnapTargets([], CONTENT, 'none', 'x')).toEqual([0, 0.5, 1])
	})

	test('adds the leading, centre and trailing edges of other elements, in fraction space', () => {
		// A 25px-wide element starting 25px into the content area
		const targets = collectSnapTargets([rect('other', 35, 20, 25, 100)], CONTENT, 'me', 'x')

		expect(targets).toEqual([0, 0.5, 1, 0.25, 0.375, 0.5])
	})

	test('excludes the element being dragged', () => {
		expect(collectSnapTargets([rect('me', 35, 20, 25, 100)], CONTENT, 'me', 'x')).toEqual([0, 0.5, 1])
	})

	test('excludes nested elements, which are not valid snap targets', () => {
		const nested = rect('child', 35, 20, 25, 100, false)

		expect(collectSnapTargets([nested], CONTENT, 'me', 'x')).toEqual([0, 0.5, 1])
	})
})

describe('snapAxis', () => {
	test('returns null when nothing is within the threshold', () => {
		expect(snapAxis([0.4], [0, 1], 0.05)).toBeNull()
	})

	test('snaps to the nearest target and reports the delta needed', () => {
		const result = snapAxis([0.48], [0, 0.5, 1], 0.05)

		expect(result?.line).toBe(0.5)
		expect(result?.delta).toBeCloseTo(0.02)
	})

	test('picks the smallest correction across several candidates', () => {
		// The trailing edge (0.98) is closer to 1 than the leading edge (0.03) is to 0
		const result = snapAxis([0.03, 0.98], [0, 1], 0.05)

		expect(result?.line).toBe(1)
		expect(result?.delta).toBeCloseTo(0.02)
	})

	test('includes a target exactly at the threshold', () => {
		expect(snapAxis([0.05], [0], 0.05)?.line).toBe(0)
	})

	test('excludes a target just beyond the threshold', () => {
		expect(snapAxis([0.0501], [0], 0.05)).toBeNull()
	})

	test('produces a negative delta when the target is behind the candidate', () => {
		const result = snapAxis([0.52], [0.5], 0.05)

		expect(result?.delta).toBeCloseTo(-0.02)
	})
})
