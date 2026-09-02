import { describe, expect, test } from 'vitest'
import type { ClientSurfaceButtonSizesItem } from '@companion-app/shared/Model/Surfaces.js'
import { collectSurfaceAspectRatios, reduceToAspectRatio } from '../surfaceAspectRatios.js'

function makeSurface(type: string, sizes: Array<[number, number]>): ClientSurfaceButtonSizesItem {
	return {
		id: type.toLowerCase().replace(/\s/g, '-'),
		type,
		displayName: `${type} (surface0)`,
		isConnected: true,
		bitmapSizes: sizes.map(([w, h]) => ({ w, h })),
	}
}

describe('reduceToAspectRatio', () => {
	test('reduces to the smallest whole number ratio', () => {
		expect(reduceToAspectRatio(248, 58)).toBe('124:29')
		expect(reduceToAspectRatio(120, 60)).toBe('2:1')
		expect(reduceToAspectRatio(200, 100)).toBe('2:1')
		expect(reduceToAspectRatio(90, 60)).toBe('3:2')
	})

	test('a square of any size is 1:1', () => {
		expect(reduceToAspectRatio(72, 72)).toBe('1:1')
		expect(reduceToAspectRatio(96, 96)).toBe('1:1')
		expect(reduceToAspectRatio(1000, 1000)).toBe('1:1')
	})

	test('an already reduced ratio is left alone', () => {
		expect(reduceToAspectRatio(9, 7)).toBe('9:7')
	})

	test('rounds non-integer sizes', () => {
		expect(reduceToAspectRatio(100.4, 50.2)).toBe('2:1')
	})

	test('rejects sizes which describe no shape', () => {
		expect(reduceToAspectRatio(0, 72)).toBeNull()
		expect(reduceToAspectRatio(72, 0)).toBeNull()
		expect(reduceToAspectRatio(-72, 72)).toBeNull()
		expect(reduceToAspectRatio(NaN, 72)).toBeNull()
		expect(reduceToAspectRatio(Infinity, 72)).toBeNull()
	})
})

describe('collectSurfaceAspectRatios', () => {
	test('has nothing to offer for no surfaces', () => {
		expect(collectSurfaceAspectRatios([])).toEqual([])
	})

	test('names the model a ratio comes from', () => {
		expect(collectSurfaceAspectRatios([makeSurface('Stream Deck Neo', [[248, 58]])])).toEqual([
			{ id: '124:29', label: '124:29 (Stream Deck Neo)' },
		])
	})

	test('a surface with several button sizes offers each of them', () => {
		expect(
			collectSurfaceAspectRatios([
				makeSurface('Stream Deck Neo', [
					[96, 96],
					[248, 58],
				]),
			])
		).toEqual([
			{ id: '1:1', label: '1:1 (Stream Deck Neo)' },
			{ id: '124:29', label: '124:29 (Stream Deck Neo)' },
		])
	})

	test('merges the models which share a ratio into one entry', () => {
		expect(
			collectSurfaceAspectRatios([
				makeSurface('Stream Deck XL', [[96, 96]]),
				makeSurface('Stream Deck Neo', [
					[96, 96],
					[248, 58],
				]),
			])
		).toEqual([
			{ id: '1:1', label: '1:1 (Stream Deck Neo, Stream Deck XL)' },
			{ id: '124:29', label: '124:29 (Stream Deck Neo)' },
		])
	})

	test('lists a model once for a ratio, however many of them are connected', () => {
		expect(
			collectSurfaceAspectRatios([makeSurface('Stream Deck XL', [[72, 72]]), makeSurface('Stream Deck XL', [[96, 96]])])
		).toEqual([{ id: '1:1', label: '1:1 (Stream Deck XL)' }])
	})

	test('a surface with no drawn buttons offers nothing', () => {
		expect(collectSurfaceAspectRatios([makeSurface('Contour Shuttle', [])])).toEqual([])
	})

	test('skips sizes which describe no shape', () => {
		expect(
			collectSurfaceAspectRatios([
				makeSurface('Broken', [
					[0, 0],
					[72, 72],
				]),
			])
		).toEqual([{ id: '1:1', label: '1:1 (Broken)' }])
	})
})
