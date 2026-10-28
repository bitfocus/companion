import { describe, expect, test } from 'vitest'
import { ImagePools } from '../../lib/Graphics/ImagePools.js'

function createPools() {
	let now = 1000
	const pools = new ImagePools<string>(100, () => now)
	return { pools, advance: (ms: number) => (now += ms) }
}

describe('ImagePools', () => {
	test('returns the same pool for a key', () => {
		const { pools } = createPools()
		const pool = pools.get('a')
		pool.push('image')

		expect(pools.get('a')).toBe(pool)
		expect(pools.get('b')).not.toBe(pool)
	})

	test('drops a pool once it has gone unused for the idle period', () => {
		const { pools, advance } = createPools()
		const stale = pools.get('stale')
		stale.push('image')

		advance(60)
		pools.get('active')
		advance(50)
		pools.get('active')

		// 'stale' was last used 110ms ago, so is replaced by a new empty pool
		expect(pools.size).toBe(1)
		expect(pools.get('stale')).not.toBe(stale)
		expect(pools.get('stale')).toEqual([])
	})

	test('keeps a pool that is in use', () => {
		const { pools, advance } = createPools()
		const pool = pools.get('a')

		for (let i = 0; i < 5; i++) {
			advance(90)
			expect(pools.get('a')).toBe(pool)
		}
	})

	test('only checks for stale pools once per idle period', () => {
		const { pools, advance } = createPools()
		pools.get('a')
		advance(50)
		pools.get('b')

		advance(50)
		pools.get('c') // checks: drops 'a' (100ms idle), keeps 'b' (50ms idle)
		expect(pools.size).toBe(2)

		advance(60)
		pools.get('c') // 'b' is now 110ms idle, but it is too soon to check again
		expect(pools.size).toBe(2)

		advance(40)
		pools.get('c') // checks again: drops 'b'
		expect(pools.size).toBe(1)
	})

	test('discards images returned to a pool after it was dropped', () => {
		const { pools, advance } = createPools()
		// As a draw in flight holds its pool
		const held = pools.get('a')

		advance(100)
		pools.get('b')
		held.push('image')

		expect(pools.get('a')).toEqual([])
	})
})
