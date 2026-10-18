import { describe, expect, test } from 'vitest'
import { ImageResult } from '../../../lib/Graphics/ImageResult.js'
import { computeBitmapId, SatelliteBitmapCache } from '../../../lib/Service/Satellite/SatelliteBitmapCache.js'

const LARGE = 256 * 256 * 4
const SMALL = 80 * 80 * 4

describe('SatelliteBitmapCache', () => {
	test('stores bitmaps at their size as rgba, with mixed sizes', () => {
		const cache = new SatelliteBitmapCache(LARGE + 2 * SMALL)

		expect(cache.store('large', 256, 256)).toEqual([])
		expect(cache.store('small1', 80, 80)).toEqual([])
		expect(cache.store('small2', 80, 80)).toEqual([])

		expect(cache.usedBytes).toBe(LARGE + 2 * SMALL)
		expect(cache.entryCount).toBe(3)
	})

	test('evicts the least recently used bitmaps to make room', () => {
		const cache = new SatelliteBitmapCache(3 * SMALL)
		cache.store('a', 80, 80)
		cache.store('b', 80, 80)
		cache.store('c', 80, 80)

		// Using `a` makes `b` the least recently used
		expect(cache.reference('a')).toBe(true)

		expect(cache.store('d', 80, 80)).toEqual(['b'])
		expect(cache.store('e', 80, 80)).toEqual(['c'])
		expect(cache.has('a')).toBe(true)
		expect(cache.usedBytes).toBe(3 * SMALL)
	})

	test('evicts several bitmaps to make room for a larger one', () => {
		const cache = new SatelliteBitmapCache(LARGE)
		cache.store('a', 80, 80)
		cache.store('b', 80, 80)

		expect(cache.store('large', 256, 256)).toEqual(['a', 'b'])
		expect(cache.usedBytes).toBe(LARGE)
	})

	test('does not store a bitmap larger than the whole budget', () => {
		const cache = new SatelliteBitmapCache(SMALL)
		cache.store('a', 80, 80)

		expect(cache.store('large', 256, 256)).toBeNull()
		expect(cache.has('a')).toBe(true)
		expect(cache.has('large')).toBe(false)
	})

	test('reference reports whether the client has a bitmap', () => {
		const cache = new SatelliteBitmapCache(SMALL)
		cache.store('a', 80, 80)

		expect(cache.reference('a')).toBe(true)
		expect(cache.reference('missing')).toBe(false)
	})

	test('a lower cost leaves room for more bitmaps', () => {
		const cache = new SatelliteBitmapCache(2 * SMALL)
		cache.store('a', 80, 80)
		cache.store('b', 80, 80)

		expect(cache.setCost('a', 100)).toEqual([])
		expect(cache.setCost('b', 100)).toEqual([])
		expect(cache.usedBytes).toBe(200)

		expect(cache.store('c', 80, 80)).toEqual([])
		expect(cache.entryCount).toBe(3)
	})

	test('a higher cost evicts the least recently used bitmaps to get back within budget', () => {
		const cache = new SatelliteBitmapCache(3 * SMALL)
		cache.store('a', 80, 80)
		cache.store('b', 80, 80)
		cache.store('c', 80, 80)

		// Evicting `a` alone brings it back within budget
		expect(cache.setCost('c', 2 * SMALL)).toEqual(['a'])
		expect(cache.usedBytes).toBe(3 * SMALL)

		expect(cache.setCost('c', 3 * SMALL)).toEqual(['b'])
		expect(cache.usedBytes).toBe(3 * SMALL)
	})

	test('a cost larger than the whole budget evicts that bitmap', () => {
		const cache = new SatelliteBitmapCache(2 * SMALL)
		cache.store('a', 80, 80)
		cache.store('b', 80, 80)

		expect(cache.setCost('a', 3 * SMALL)).toEqual(['a'])
		expect(cache.has('b')).toBe(true)
	})

	test('a cost for a bitmap the client does not have is ignored', () => {
		const cache = new SatelliteBitmapCache(SMALL)

		expect(cache.setCost('missing', 100)).toEqual([])
		expect(cache.entryCount).toBe(0)
	})

	test('shrinking evicts the least recently used bitmaps until the total fits', () => {
		const cache = new SatelliteBitmapCache(3 * SMALL)
		cache.store('a', 80, 80)
		cache.store('b', 80, 80)
		cache.store('c', 80, 80)
		cache.reference('a')

		expect(cache.resize(2 * SMALL)).toEqual(['b'])
		expect(cache.budgetBytes).toBe(2 * SMALL)
		expect(cache.usedBytes).toBe(2 * SMALL)

		// The order is kept: `c` is now the least recently used
		expect(cache.store('d', 80, 80)).toEqual(['c'])
	})

	test('growing evicts nothing', () => {
		const cache = new SatelliteBitmapCache(SMALL)
		cache.store('a', 80, 80)

		expect(cache.resize(10 * SMALL)).toEqual([])
		expect(cache.has('a')).toBe(true)
		expect(cache.budgetBytes).toBe(10 * SMALL)
	})

	test('shrinking to 0 evicts everything', () => {
		const cache = new SatelliteBitmapCache(2 * SMALL)
		cache.store('a', 80, 80)
		cache.store('b', 80, 80)

		expect(cache.resize(0).sort()).toEqual(['a', 'b'])
		expect(cache.entryCount).toBe(0)
	})

	test('keeps an accurate total over many stores and evictions', () => {
		const budget = 5 * SMALL + LARGE
		const cache = new SatelliteBitmapCache(budget)
		const held = new Map<string, number>()

		for (let i = 0; i < 500; i++) {
			const large = i % 7 === 0
			const id = `bitmap-${i % 37}-${large}`
			if (cache.reference(id)) continue

			const evicted = cache.store(id, large ? 256 : 80, large ? 256 : 80)
			for (const evictedId of evicted ?? []) held.delete(evictedId)
			if (evicted) held.set(id, large ? LARGE : SMALL)

			const total = [...held.values()].reduce((a, b) => a + b, 0)
			expect(cache.usedBytes).toBe(total)
			expect(total).toBeLessThanOrEqual(budget)
		}
	})
})

describe('computeBitmapId', () => {
	function makeImage(cacheKey: string | undefined): ImageResult {
		return new ImageResult(cacheKey, { type: 'button' }, async () => new Uint8Array())
	}

	test('is stable for the same render and output', () => {
		const image = makeImage('key-a')
		const id = computeBitmapId(image, 72, 72, null, 'rgb')
		expect(id).toMatch(/^[\w-]{16}$/)
		expect(computeBitmapId(image, 72, 72, null, 'rgb')).toBe(id)
		expect(computeBitmapId(makeImage('key-a'), 72, 72, null, 'rgb')).toBe(id)
	})

	test('differs when anything about the output changes', () => {
		const image = makeImage('key-a')
		const id = computeBitmapId(image, 72, 72, null, 'rgb')

		expect(computeBitmapId(makeImage('key-b'), 72, 72, null, 'rgb')).not.toBe(id)
		expect(computeBitmapId(image, 96, 72, null, 'rgb')).not.toBe(id)
		expect(computeBitmapId(image, 72, 96, null, 'rgb')).not.toBe(id)
		expect(computeBitmapId(image, 72, 72, 90, 'rgb')).not.toBe(id)
		expect(computeBitmapId(image, 72, 72, null, 'webp')).not.toBe(id)
	})

	test('a render without a content key has no id', () => {
		expect(computeBitmapId(makeImage(undefined), 72, 72, null, 'rgb')).toBeNull()
	})
})
