import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import z from 'zod'
import { DataCache } from '../../lib/Data/Cache.js'
import { BROKEN_ROWS_TABLE, type BrokenRowRecord } from '../../lib/Data/SchemaTableView.js'

const schema = z.object({ name: z.string(), count: z.number().default(0) })

describe('DataStoreSchemaTableView', () => {
	let cache: DataCache

	beforeEach(() => {
		cache = new DataCache(':memory:', () => {})
	})
	afterEach(() => {
		cache.close()
	})

	const rawTable = () => cache.getTableView<Record<string, any>>('tbl')
	const brokenRows = () => Object.values(cache.getTableView<Record<string, BrokenRowRecord>>(BROKEN_ROWS_TABLE).all())

	test('fills in defaults and strips unknown properties', () => {
		rawTable().setPrimitive('a', JSON.stringify({ name: 'first' }))
		rawTable().setPrimitive('b', JSON.stringify({ name: 'second', count: 2, extra: true }))

		const view = cache.getSchemaTableView('tbl', schema)
		expect(view.all()).toEqual({ a: { name: 'first', count: 0 }, b: { name: 'second', count: 2 } })
		expect(view.get('a')).toEqual({ name: 'first', count: 0 })
	})

	test('round trips a set value', () => {
		const view = cache.getSchemaTableView('tbl', schema)
		view.set('a', { name: 'x', count: 3 })
		expect(view.get('a')).toEqual({ name: 'x', count: 3 })
		expect(view.get('missing')).toBeUndefined()
	})

	test('normalises a set value', () => {
		const view = cache.getSchemaTableView('tbl', schema)
		expect(view.set('a', { name: 'x', extra: true } as any)).toEqual({ name: 'x', count: 0 })
		expect(rawTable().get('a')).toEqual({ name: 'x', count: 0 })
	})

	test('checks a set value as it will be stored', () => {
		const jsonSchema = z.object({ name: z.string(), value: z.json().optional() })
		const view = cache.getSchemaTableView('tbl', jsonSchema)

		// Encoding turns these into null and drops the undefined property, all of which the schema accepts
		const unencodable: any = [Infinity, NaN, { dropped: undefined }]
		expect(view.set('a', { name: 'x', value: unencodable })).toEqual({
			name: 'x',
			value: [null, null, {}],
		})
		expect(rawTable().get('a')).toEqual({ name: 'x', value: [null, null, {}] })
	})

	test('refuses to set a value that fails the schema', () => {
		const view = cache.getSchemaTableView('tbl', schema)
		expect(() => view.set('a', { count: 3 } as any)).toThrow(/Invalid value for "tbl" row "a"/)
		expect(rawTable().get('a')).toBeUndefined()
	})

	test('moves rows that fail the schema to the broken rows table', () => {
		rawTable().set('good', { name: 'ok', count: 1 })
		rawTable().setPrimitive('bad', JSON.stringify({ count: 'nope' }))
		rawTable().setPrimitive('raw', 'not-json')

		const view = cache.getSchemaTableView('tbl', schema)
		expect(view.all()).toEqual({ good: { name: 'ok', count: 1 } })

		// Removed from the source table
		expect(Object.keys(rawTable().all())).toEqual(['good'])

		const broken = brokenRows().sort((a, b) => a.rowId.localeCompare(b.rowId))
		expect(broken).toEqual([
			{
				table: 'tbl',
				rowId: 'bad',
				value: '{"count":"nope"}',
				reason: expect.any(String),
				timestamp: expect.any(Number),
			},
			{
				table: 'tbl',
				rowId: 'raw',
				value: 'not-json',
				reason: expect.stringMatching(/^Invalid JSON/),
				timestamp: expect.any(Number),
			},
		])
	})

	test('keeps a broken row in place when it cannot be moved', () => {
		rawTable().setPrimitive('bad', JSON.stringify({ count: 1 }))
		vi.spyOn(cache.getTableView(BROKEN_ROWS_TABLE), 'set').mockReturnValue(false)

		const view = cache.getSchemaTableView('tbl', schema)
		expect(view.all()).toEqual({})
		expect(rawTable().get('bad')).toEqual({ count: 1 })
	})

	test('get moves a broken row', () => {
		rawTable().setPrimitive('bad', JSON.stringify({ count: 1 }))

		const view = cache.getSchemaTableView('tbl', schema)
		expect(view.get('bad')).toBeUndefined()
		expect(rawTable().get('bad')).toBeUndefined()
		expect(brokenRows()).toHaveLength(1)
	})

	test('returns the same view for the same schema, and refuses a different one', () => {
		const view = cache.getSchemaTableView('tbl', schema)
		expect(cache.getSchemaTableView('tbl', schema)).toBe(view)
		expect(() => cache.getSchemaTableView('tbl', z.object({ other: z.string() }))).toThrow()
	})

	test('operation stats are merged with a plain view of the same table', () => {
		rawTable().set('a', { name: 'x' })
		cache.getSchemaTableView('tbl', schema).set('b', { name: 'y', count: 1 })

		const stats = cache.getTableOperationStats().filter((s) => s.table === 'tbl')
		expect(stats).toHaveLength(1)
		expect(stats[0].counts.set).toBe(2)
	})

	test('refuses to view the broken rows table', () => {
		expect(() => cache.getSchemaTableView(BROKEN_ROWS_TABLE, schema)).toThrow()
	})
})
