import { describe, expect, test } from 'vitest'
import { FakeDataDatabase, FakeTableView } from './FakeTableView.js'

describe('FakeTableView', () => {
	test('set / get round trips a value', () => {
		const view = new FakeTableView<{ x: number }>()
		view.set('a', { x: 1 })
		expect(view.get('a')).toEqual({ x: 1 })
	})

	test('get returns undefined for a missing key', () => {
		const view = new FakeTableView<number>()
		expect(view.get('missing')).toBeUndefined()
	})

	test('clones on write so later mutations of the source do not leak in', () => {
		const view = new FakeTableView<{ x: number }>()
		const value = { x: 1 }
		view.set('a', value)
		value.x = 999
		expect(view.get('a')).toEqual({ x: 1 })
	})

	test('clones on read so mutating the result does not leak into storage', () => {
		const view = new FakeTableView<{ x: number }>()
		view.set('a', { x: 1 })
		const read = view.get('a')!
		read.x = 999
		expect(view.get('a')).toEqual({ x: 1 })
	})

	test('all returns a clone of the whole table', () => {
		const view = new FakeTableView<{ x: number }>()
		view.set('a', { x: 1 })
		view.set('b', { x: 2 })

		const snapshot = view.all()
		expect(snapshot).toEqual({ a: { x: 1 }, b: { x: 2 } })

		// Mutating the snapshot must not affect the stored data
		snapshot.a.x = 999
		expect(view.get('a')).toEqual({ x: 1 })
	})

	describe('getOrDefault', () => {
		test('returns the stored value when present', () => {
			const view = new FakeTableView<{ x: number }>()
			view.set('a', { x: 5 })
			expect(view.getOrDefault('a', { x: 99 })).toEqual({ x: 5 })
		})

		test('stores and returns the default when the key is missing', () => {
			const view = new FakeTableView<{ x: number }>()
			expect(view.getOrDefault('a', { x: 7 })).toEqual({ x: 7 })
			// The default is persisted
			expect(view.get('a')).toEqual({ x: 7 })
		})

		test('stores a clone of the default, not the caller reference', () => {
			const view = new FakeTableView<{ x: number }>()
			const def = { x: 7 }
			view.getOrDefault('a', def)
			def.x = 999
			expect(view.get('a')).toEqual({ x: 7 })
		})
	})

	test('delete removes a key', () => {
		const view = new FakeTableView<number>()
		view.set('a', 1)
		view.set('b', 2)
		view.delete('a')
		expect(view.get('a')).toBeUndefined()
		expect(view.get('b')).toBe(2)
	})

	test('clear empties the table', () => {
		const view = new FakeTableView<number>()
		view.set('a', 1)
		view.set('b', 2)
		view.clear()
		expect(view.all()).toEqual({})
	})

	test('asTableView returns the same object typed as a DataStoreTableView', () => {
		const view = new FakeTableView<number>()
		expect(view.asTableView()).toBe(view)
	})
})

describe('FakeDataDatabase', () => {
	test('getTableView creates a table lazily and caches it', () => {
		const db = new FakeDataDatabase()
		const a = db.getTableView('one')
		const b = db.getTableView('one')
		expect(a).toBe(b)
		expect(db.getTableView('two')).not.toBe(a)
	})

	test('defaultTableView maps to the "main" table', () => {
		const db = new FakeDataDatabase()
		expect(db.defaultTableView).toBe(db.getTableView('main'))
	})

	test('tables handed out by getTableView actually store data', () => {
		const db = new FakeDataDatabase()
		db.getTableView('t').set('k', { v: 1 })
		expect(db.getTableView('t').get('k')).toEqual({ v: 1 })
	})

	test('getIsFirstRun reflects the isFirstRun field', () => {
		const db = new FakeDataDatabase()
		expect(db.getIsFirstRun()).toBe(true)
		db.isFirstRun = false
		expect(db.getIsFirstRun()).toBe(false)
	})

	test('exposes its tables through the internal map', () => {
		const db = new FakeDataDatabase()
		db.getTableView('one')
		db.getTableView('two')
		expect([...db.tables.keys()].sort()).toEqual(['one', 'two'])
	})
})
