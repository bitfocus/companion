import { describe, expect, test } from 'vitest'
import { DataCache } from '../../lib/Data/Cache.js'
import type { DatabaseOperation } from '../../lib/Data/StoreBase.js'

// DataCache is the simplest concrete DataStoreBase; ':memory:' keeps it entirely in RAM for tests.
const noopObserver = () => {}

describe('DataStoreBase operation metrics', () => {
	test('counts operations per table and kind', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const view = cache.getTableView<Record<string, { x: number }>>('op_counts')
			view.set('a', { x: 1 })
			view.set('b', { x: 2 })
			view.get('a')
			view.all()
			view.delete('b')
			view.clear()

			const stats = cache.getTableOperationStats().find((s) => s.table === 'op_counts')
			expect(stats).toBeDefined()
			expect(stats!.counts.set).toBe(2)
			expect(stats!.counts.get).toBe(1)
			expect(stats!.counts.get_all).toBe(1)
			expect(stats!.counts.delete).toBe(1)
			expect(stats!.counts.clear).toBe(1)

			// A healthy table records no errors
			for (const op of Object.keys(stats!.errors) as DatabaseOperation[]) {
				expect(stats!.errors[op]).toBe(0)
			}
		} finally {
			cache.close()
		}
	})

	test('records errors when the operation throws', () => {
		const cache = new DataCache(':memory:', noopObserver)
		const view = cache.getTableView<Record<string, { x: number }>>('op_errors')

		// Closing the database makes the prepared statements throw; the view swallows the error (warn-log)
		// but must still count it.
		cache.close()
		view.set('a', { x: 1 })

		const stats = cache.getTableOperationStats().find((s) => s.table === 'op_errors')
		expect(stats!.errors.set).toBe(1)
		expect(stats!.counts.set).toBe(0)
	})

	test('reports row counts per table', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const view = cache.getTableView<Record<string, { x: number }>>('row_counts')
			view.set('a', { x: 1 })
			view.set('b', { x: 2 })
			view.set('c', { x: 3 })

			const rows = cache.getTableRowCounts().find((r) => r.table === 'row_counts')
			expect(rows?.rows).toBe(3)
		} finally {
			cache.close()
		}
	})

	test('reports operation timings to the injected observer', () => {
		const seen: { table: string; operation: DatabaseOperation; seconds: number }[] = []
		const cache = new DataCache(':memory:', (table, operation, seconds) => seen.push({ table, operation, seconds }))
		try {
			const view = cache.getTableView<Record<string, { x: number }>>('obs')
			view.set('a', { x: 1 })
			view.get('a')

			const relevant = seen.filter((s) => s.table === 'obs')
			expect(relevant.some((s) => s.operation === 'set')).toBe(true)
			expect(relevant.some((s) => s.operation === 'get')).toBe(true)
			expect(relevant.every((s) => s.seconds >= 0)).toBe(true)
		} finally {
			cache.close()
		}
	})
})
