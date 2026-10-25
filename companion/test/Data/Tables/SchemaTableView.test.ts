import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import z from 'zod'
import { DataCache } from '../../../lib/Data/Cache.js'
import {
	BROKEN_ROWS_TABLE,
	type BrokenRowRecord,
	type SchemaTableViewRepair,
} from '../../../lib/Data/Tables/ParsedTableViewBase.js'

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

	describe('repair', () => {
		// Fill in a missing name, as a repair might replace something that failed
		const fillName: SchemaTableViewRepair = (row) =>
			row && typeof row === 'object' && !('name' in row)
				? { row: { ...row, name: 'repaired' }, repairs: ['Filled in the name'] }
				: null

		test('a row that fails is repaired and stored, rather than moved to the broken rows', () => {
			rawTable().setPrimitive('a', JSON.stringify({ count: 2 }))
			const view = cache.getSchemaTableView('tbl', schema, { repair: fillName })

			expect(view.all()).toEqual({ a: { name: 'repaired', count: 2 } })
			expect(rawTable().get('a')).toEqual({ name: 'repaired', count: 2 })
			expect(brokenRows()).toEqual([])
		})

		test('a row that cannot be repaired is still moved to the broken rows', () => {
			rawTable().setPrimitive('a', JSON.stringify({ name: 5 }))
			const view = cache.getSchemaTableView('tbl', schema, { repair: fillName })

			expect(view.all()).toEqual({})
			expect(brokenRows()).toEqual([expect.objectContaining({ rowId: 'a', value: '{"name":5}' })])
		})

		test('a repair can take more than one attempt', () => {
			rawTable().setPrimitive('a', JSON.stringify({ count: 'x' }))
			const repair: SchemaTableViewRepair = (row: any) =>
				typeof row.count !== 'number'
					? { row: { ...row, count: 1 }, repairs: ['Fixed the count'] }
					: { row: { ...row, name: 'n' }, repairs: ['Filled in the name'] }
			const view = cache.getSchemaTableView('tbl', schema, { repair })

			expect(view.get('a')).toEqual({ name: 'n', count: 1 })
		})

		test('a repair that never succeeds moves the original row to the broken rows', () => {
			rawTable().setPrimitive('a', JSON.stringify({ count: 'x' }))
			const view = cache.getSchemaTableView('tbl', schema, {
				repair: (row) => ({ row, repairs: ['Made no difference'] }),
			})

			expect(view.all()).toEqual({})
			expect(brokenRows()).toEqual([expect.objectContaining({ rowId: 'a', value: '{"count":"x"}' })])
		})

		test('refuses a view of the same table with a different repair', () => {
			cache.getSchemaTableView('tbl', schema, { repair: fillName })

			expect(() => cache.getSchemaTableView('tbl', schema)).toThrow('different options')
		})
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

	test('without write validation, a set value is stored as it is, but still checked when read', () => {
		const view = cache.getSchemaTableView('tbl', schema, { validateWrites: false })

		expect(view.set('a', { name: 'x', extra: true } as any)).toEqual({ name: 'x', extra: true })
		expect(rawTable().get('a')).toEqual({ name: 'x', extra: true })

		// An invalid value isn't refused when written
		expect(() => view.set('bad', { count: 3 } as any)).not.toThrow()
		expect(rawTable().get('bad')).toEqual({ count: 3 })

		// But reading normalises the row, and moves the invalid one to the broken rows table
		expect(view.all()).toEqual({ a: { name: 'x', count: 0 } })
		expect(brokenRows()).toEqual([expect.objectContaining({ rowId: 'bad' })])
	})

	test('refuses a view of the same table with different options', () => {
		cache.getSchemaTableView('tbl', schema, { validateWrites: true })

		expect(() => cache.getSchemaTableView('tbl', schema, { validateWrites: false })).toThrow('different options')
	})

	test('refuses to view the broken rows table', () => {
		expect(() => cache.getSchemaTableView(BROKEN_ROWS_TABLE, schema)).toThrow()
	})
})

describe('DataStoreKeyedSchemaTableView', () => {
	let cache: DataCache

	beforeEach(() => {
		cache = new DataCache(':memory:', () => {})
	})
	afterEach(() => {
		cache.close()
	})

	const schemas = {
		version: z.number().default(1),
		settings: z.object({ name: z.string().default('none'), count: z.number().default(0) }).default(() => ({
			name: 'none',
			count: 0,
		})),
	}

	const rawTable = () => cache.getTableView<Record<string, any>>('tbl')
	const brokenRows = () => Object.values(cache.getTableView<Record<string, BrokenRowRecord>>(BROKEN_ROWS_TABLE).all())

	test('parses each row with its own schema', () => {
		rawTable().set('version', 3)
		rawTable().setPrimitive('settings', JSON.stringify({ name: 'x', extra: true }))

		const view = cache.getKeyedSchemaTableView('tbl', schemas)
		expect(view.get('version')).toBe(3)
		expect(view.get('settings')).toEqual({ name: 'x', count: 0 })
	})

	test('gives the default for a missing row, without storing it', () => {
		const view = cache.getKeyedSchemaTableView('tbl', schemas)
		expect(view.get('version')).toBe(1)
		expect(view.get('settings')).toEqual({ name: 'none', count: 0 })
		expect(rawTable().all()).toEqual({})
	})

	test('moves a row that fails to the broken rows, and gives its default', () => {
		rawTable().setPrimitive('version', '"three"')

		const view = cache.getKeyedSchemaTableView('tbl', schemas)
		expect(view.get('version')).toBe(1)
		expect(rawTable().all()).toEqual({})
		expect(brokenRows()).toEqual([expect.objectContaining({ table: 'tbl', rowId: 'version', value: '"three"' })])
	})

	test('repairs a row with the repair for its key', () => {
		rawTable().setPrimitive('settings', JSON.stringify({ name: 5, count: 2 }))
		const repair: SchemaTableViewRepair = (row: any) => ({
			row: { ...row, name: 'fixed' },
			repairs: ['fixed the name'],
		})

		const view = cache.getKeyedSchemaTableView('tbl', schemas, { repair: { settings: repair } })
		expect(view.get('settings')).toEqual({ name: 'fixed', count: 2 })
		expect(rawTable().get('settings')).toEqual({ name: 'fixed', count: 2 })
		expect(brokenRows()).toEqual([])
	})

	test('normalises a set value, and refuses one that fails', () => {
		const view = cache.getKeyedSchemaTableView('tbl', schemas)
		expect(view.set('settings', { name: 'x' } as any)).toEqual({ name: 'x', count: 0 })
		expect(rawTable().get('settings')).toEqual({ name: 'x', count: 0 })

		expect(() => view.set('version', 'four' as any)).toThrow(/Invalid value for "tbl" row "version"/)
		expect(rawTable().get('version')).toBeUndefined()
	})

	test('ignores rows without a schema, and refuses to use them', () => {
		rawTable().set('legacy' as any, { old: true })

		const view = cache.getKeyedSchemaTableView('tbl', schemas)
		expect(() => view.get('legacy' as any)).toThrow(/has no row "legacy"/)
		expect(() => view.set('legacy' as any, 1)).toThrow(/has no row "legacy"/)
		expect(rawTable().get('legacy' as any)).toEqual({ old: true })
	})

	test('a deleted row reads as its default', () => {
		const view = cache.getKeyedSchemaTableView('tbl', schemas)
		view.set('version', 5)
		view.delete('version')
		expect(view.get('version')).toBe(1)
	})

	test('refuses a row schema without a default', () => {
		expect(() => cache.getKeyedSchemaTableView('tbl', { version: z.number() })).toThrow(
			/Row "version" of "tbl" has no default/
		)
	})

	test('returns the same view for the same schemas, and refuses different ones or options', () => {
		const view = cache.getKeyedSchemaTableView('tbl', schemas)
		expect(cache.getKeyedSchemaTableView('tbl', schemas)).toBe(view)
		expect(() => cache.getKeyedSchemaTableView('tbl', { ...schemas })).toThrow(/different schemas/)
		expect(() => cache.getKeyedSchemaTableView('tbl', schemas, { repair: {} })).toThrow(/different options/)
		expect(() => cache.getKeyedSchemaTableView(BROKEN_ROWS_TABLE, schemas)).toThrow(/broken rows/)
	})
})
