import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import fs from 'fs-extra'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { DataCache } from '../../lib/Data/Cache.js'
import { DataDatabase } from '../../lib/Data/Database.js'
import type { DatabaseOperation, DataStoreTableView } from '../../lib/Data/StoreBase.js'

// DataCache is the simplest concrete DataStoreBase; ':memory:' keeps it entirely in RAM for tests.
const noopObserver = () => {}

/** Convenience: an in-memory cache plus a fresh typed table view. */
function makeView<T extends Record<string, any> = Record<string, any>>(
	tableName = 'tbl'
): { cache: DataCache; view: DataStoreTableView<T> } {
	const cache = new DataCache(':memory:', noopObserver)
	const view = cache.getTableView<T>(tableName)
	return { cache, view }
}

describe('DataStoreTableView', () => {
	describe('set / get round trips', () => {
		test('stores and retrieves an object', () => {
			const { cache, view } = makeView<Record<string, { x: number; label: string }>>()
			try {
				view.set('a', { x: 1, label: 'hello' })
				expect(view.get('a')).toEqual({ x: 1, label: 'hello' })
			} finally {
				cache.close()
			}
		})

		test('stores and retrieves a number', () => {
			const { cache, view } = makeView<Record<string, number>>()
			try {
				view.set('n', 42)
				expect(view.get('n')).toBe(42)
			} finally {
				cache.close()
			}
		})

		test('stores and retrieves a nested structure', () => {
			const { cache, view } = makeView<Record<string, any>>()
			try {
				const value = { arr: [1, 2, { deep: true }], nested: { a: { b: 'c' } } }
				view.set('complex', value)
				expect(view.get('complex')).toEqual(value)
			} finally {
				cache.close()
			}
		})

		test('overwrites an existing value on repeated set', () => {
			const { cache, view } = makeView<Record<string, { x: number }>>()
			try {
				view.set('a', { x: 1 })
				view.set('a', { x: 2 })
				expect(view.get('a')).toEqual({ x: 2 })
			} finally {
				cache.close()
			}
		})

		test('returns undefined for a missing key', () => {
			const { cache, view } = makeView<Record<string, { x: number }>>()
			try {
				expect(view.get('nope')).toBeUndefined()
			} finally {
				cache.close()
			}
		})

		test('keeps separate values for separate keys', () => {
			const { cache, view } = makeView<Record<string, number>>()
			try {
				view.set('a', 1)
				view.set('b', 2)
				expect(view.get('a')).toBe(1)
				expect(view.get('b')).toBe(2)
			} finally {
				cache.close()
			}
		})
	})

	describe('primitive helpers', () => {
		test('setPrimitive / getPrimitiveOrDefault store a raw string without JSON encoding', () => {
			const { cache, view } = makeView<Record<string, string>>()
			try {
				view.setPrimitive('k', 'plain-text')
				expect(view.getPrimitiveOrDefault('k', 'fallback')).toBe('plain-text')
			} finally {
				cache.close()
			}
		})

		test('getPrimitiveOrDefault persists the default when the key is missing', () => {
			const { cache, view } = makeView<Record<string, string>>()
			try {
				expect(view.getPrimitiveOrDefault('missing', 'the-default')).toBe('the-default')
				// The default should now be stored, so a second read returns it too
				expect(view.getPrimitiveOrDefault('missing', 'other')).toBe('the-default')
			} finally {
				cache.close()
			}
		})

		test('a primitive string is stored verbatim (not JSON-quoted)', () => {
			const { cache, view } = makeView<Record<string, string>>()
			try {
				view.setPrimitive('k', 'hello')
				// all() sees the raw stored string; a non-JSON value falls back to the raw string
				expect(view.all()).toEqual({ k: 'hello' })
			} finally {
				cache.close()
			}
		})
	})

	describe('getOrDefault', () => {
		test('returns the stored value when present, without overwriting', () => {
			const { cache, view } = makeView<Record<string, { x: number }>>()
			try {
				view.set('a', { x: 5 })
				expect(view.getOrDefault('a', { x: 99 })).toEqual({ x: 5 })
			} finally {
				cache.close()
			}
		})

		test('persists and returns the default when the key is missing', () => {
			const { cache, view } = makeView<Record<string, { x: number }>>()
			try {
				expect(view.getOrDefault('a', { x: 7 })).toEqual({ x: 7 })
				// The default was written, so a direct get now sees it
				expect(view.get('a')).toEqual({ x: 7 })
			} finally {
				cache.close()
			}
		})

		test('falls back to the default (without overwriting) when the stored value is unparsable', () => {
			const { cache, view } = makeView<Record<string, any>>()
			try {
				// setPrimitive stores a value that is not valid JSON
				view.setPrimitive('a', 'not-json')
				expect(view.getOrDefault('a', { x: 1 })).toEqual({ x: 1 })
				// The corrupt value is left in place (getOrDefault only writes when the key is absent)
				expect(view.getPrimitiveOrDefault('a', 'x')).toBe('not-json')
			} finally {
				cache.close()
			}
		})
	})

	describe('all', () => {
		test('returns every row keyed by id, JSON-decoded', () => {
			const { cache, view } = makeView<Record<string, any>>()
			try {
				view.set('a', { x: 1 })
				view.set('b', 2)
				view.set('c', [1, 2, 3])
				expect(view.all()).toEqual({ a: { x: 1 }, b: 2, c: [1, 2, 3] })
			} finally {
				cache.close()
			}
		})

		test('returns an empty object for an empty table', () => {
			const { cache, view } = makeView()
			try {
				expect(view.all()).toEqual({})
			} finally {
				cache.close()
			}
		})

		test('mixes JSON-decoded and raw-string values', () => {
			const { cache, view } = makeView<Record<string, any>>()
			try {
				view.set('json', { ok: true })
				view.setPrimitive('raw' as any, 'just-a-string')
				expect(view.all()).toEqual({ json: { ok: true }, raw: 'just-a-string' })
			} finally {
				cache.close()
			}
		})
	})

	describe('delete / clear', () => {
		test('delete removes a single key and leaves the rest', () => {
			const { cache, view } = makeView<Record<string, number>>()
			try {
				view.set('a', 1)
				view.set('b', 2)
				view.delete('a')
				expect(view.get('a')).toBeUndefined()
				expect(view.get('b')).toBe(2)
			} finally {
				cache.close()
			}
		})

		test('deleting a missing key is a no-op', () => {
			const { cache, view } = makeView<Record<string, number>>()
			try {
				view.set('b', 2)
				expect(() => view.delete('missing')).not.toThrow()
				expect(view.get('b')).toBe(2)
			} finally {
				cache.close()
			}
		})

		test('clear empties the whole table', () => {
			const { cache, view } = makeView<Record<string, number>>()
			try {
				view.set('a', 1)
				view.set('b', 2)
				view.clear()
				expect(view.all()).toEqual({})
			} finally {
				cache.close()
			}
		})
	})

	describe('key validation', () => {
		test.each([
			['get', (v: DataStoreTableView<any>) => v.get('')],
			['getOrDefault', (v: DataStoreTableView<any>) => v.getOrDefault('', 1)],
			['getPrimitiveOrDefault', (v: DataStoreTableView<any>) => v.getPrimitiveOrDefault('', 'x')],
			['set', (v: DataStoreTableView<any>) => v.set('', 1)],
			['setPrimitive', (v: DataStoreTableView<any>) => v.setPrimitive('', 'x')],
			['delete', (v: DataStoreTableView<any>) => v.delete('')],
		])('%s throws on an empty-string key', (_name, op) => {
			const { cache, view } = makeView()
			try {
				expect(() => op(view)).toThrow(/Invalid key/)
			} finally {
				cache.close()
			}
		})

		test('throws on a non-string key', () => {
			const { cache, view } = makeView()
			try {
				expect(() => view.get(123 as any)).toThrow(/Invalid key/)
				expect(() => view.set(null as any, 1)).toThrow(/Invalid key/)
			} finally {
				cache.close()
			}
		})
	})

	describe('operation metrics', () => {
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

		test('collectOperationStats returns an immutable snapshot', () => {
			const { cache, view } = makeView<Record<string, number>>('snap')
			try {
				view.set('a', 1)
				const snapshot = view.collectOperationStats()
				expect(snapshot.counts.set).toBe(1)

				// Mutating the snapshot must not affect future reads
				snapshot.counts.set = 999
				expect(view.collectOperationStats().counts.set).toBe(1)

				// Subsequent operations accumulate independently of the old snapshot
				view.set('b', 2)
				expect(view.collectOperationStats().counts.set).toBe(2)
			} finally {
				cache.close()
			}
		})

		test.each<[DatabaseOperation, (v: DataStoreTableView<any>) => void]>([
			['set', (v) => v.set('a', { x: 1 })],
			['get', (v) => void v.get('a')],
			['get_all', (v) => void v.all()],
			['delete', (v) => v.delete('a')],
			['clear', (v) => v.clear()],
		])('records a %s error when the underlying statement throws', (op, act) => {
			const cache = new DataCache(':memory:', noopObserver)
			const view = cache.getTableView<Record<string, { x: number }>>('op_errors')

			// Closing the database makes the prepared statements throw; the view swallows the error (warn-log)
			// but must still count it.
			cache.close()
			act(view)

			const stats = cache.getTableOperationStats().find((s) => s.table === 'op_errors')
			expect(stats!.errors[op]).toBe(1)
			expect(stats!.counts[op]).toBe(0)
		})

		test('reports operation timings to the injected observer', () => {
			const seen: { table: string; operation: DatabaseOperation; seconds: number }[] = []
			const cache = new DataCache(':memory:', (table, operation, seconds) => seen.push({ table, operation, seconds }))
			try {
				const view = cache.getTableView<Record<string, { x: number }>>('obs')
				view.set('a', { x: 1 })
				view.get('a')
				view.all()
				view.delete('a')
				view.clear()

				const relevant = seen.filter((s) => s.table === 'obs')
				const kinds = new Set(relevant.map((s) => s.operation))
				expect(kinds).toEqual(new Set<DatabaseOperation>(['set', 'get', 'get_all', 'delete', 'clear']))
				expect(relevant.every((s) => s.seconds >= 0)).toBe(true)
			} finally {
				cache.close()
			}
		})

		test('the observer is fed even when the operation errors', () => {
			const seen: DatabaseOperation[] = []
			const cache = new DataCache(':memory:', (_table, operation) => seen.push(operation))
			const view = cache.getTableView<Record<string, { x: number }>>('obs_err')
			cache.close()
			view.set('a', { x: 1 })
			expect(seen).toContain('set')
		})
	})
})

describe('DataStoreBase table management', () => {
	test('getTableView returns a cached instance for the same table', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const a = cache.getTableView('same')
			const b = cache.getTableView('same')
			expect(a).toBe(b)
		} finally {
			cache.close()
		}
	})

	test('getTableView returns distinct instances for different tables', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			expect(cache.getTableView('one')).not.toBe(cache.getTableView('two'))
		} finally {
			cache.close()
		}
	})

	test('defaultTableView targets the store default table', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			// DataCache's default table is 'main'
			expect(cache.defaultTableView).toBe(cache.getTableView('main'))
		} finally {
			cache.close()
		}
	})

	test.each([['getTableView'], ['tableExists']])('%s rejects an invalid table name', (method) => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			expect(() => (cache as any)[method]('')).toThrow(/Invalid table name/)
			expect(() => (cache as any)[method](123)).toThrow(/Invalid table name/)
		} finally {
			cache.close()
		}
	})

	test('tableExists reflects whether a table has been created', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			expect(cache.tableExists('brand_new')).toBe(false)
			cache.getTableView('brand_new') // creating the view creates the table
			expect(cache.tableExists('brand_new')).toBe(true)
		} finally {
			cache.close()
		}
	})

	test('getTableOperationStats only covers tables that have a view', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			cache.getTableView('seen')
			const tables = cache.getTableOperationStats().map((s) => s.table)
			expect(tables).toContain('seen')
			expect(tables).not.toContain('never_touched')
		} finally {
			cache.close()
		}
	})

	test('getTableRowCounts enumerates every table, including untouched ones', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const populated = cache.getTableView<Record<string, number>>('with_rows')
			populated.set('a', 1)
			populated.set('b', 2)
			cache.getTableView('empty_table') // created but never written to

			const counts = cache.getTableRowCounts()
			expect(counts.find((r) => r.table === 'with_rows')?.rows).toBe(2)
			expect(counts.find((r) => r.table === 'empty_table')?.rows).toBe(0)
		} finally {
			cache.close()
		}
	})

	test('getDiskSizeInfo returns positive totals and a non-negative free amount', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const view = cache.getTableView<Record<string, number>>('sized')
			view.set('a', 1)

			const info = cache.getDiskSizeInfo()
			expect(info.totalBytes).toBeGreaterThan(0)
			expect(info.freeBytes).toBeGreaterThanOrEqual(0)
			expect(info.freeBytes).toBeLessThanOrEqual(info.totalBytes)
		} finally {
			cache.close()
		}
	})

	test('getTableRowCounts / getDiskSizeInfo degrade gracefully once the store is closed', () => {
		const cache = new DataCache(':memory:', noopObserver)
		cache.getTableView('t')
		cache.close()

		// The pragmas/queries throw against a closed database; the accessors must swallow and return safe defaults
		expect(cache.getTableRowCounts()).toEqual([])
		expect(cache.getDiskSizeInfo()).toEqual({ totalBytes: 0, freeBytes: 0 })
	})
})

describe('DataStoreBase.renameTable', () => {
	test('performs a simple rename when the destination does not exist', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const old = cache.getTableView<Record<string, { v: number }>>('old_name')
			old.set('k', { v: 1 })

			cache.renameTable('old_name', 'new_name')

			expect(cache.tableExists('old_name')).toBe(false)
			expect(cache.tableExists('new_name')).toBe(true)
			expect(cache.getTableView<Record<string, { v: number }>>('new_name').get('k')).toEqual({ v: 1 })
		} finally {
			cache.close()
		}
	})

	test('merges into an existing destination, with the source winning conflicts', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const old = cache.getTableView<Record<string, { from: string }>>('src')
			old.set('only_old', { from: 'old' })
			old.set('shared', { from: 'old' })

			const dest = cache.getTableView<Record<string, { from: string }>>('dst')
			dest.set('only_new', { from: 'new' })
			dest.set('shared', { from: 'new' })

			cache.renameTable('src', 'dst')

			const merged = cache.getTableView<Record<string, { from: string }>>('dst')
			expect(merged.get('only_old')).toEqual({ from: 'old' })
			expect(merged.get('only_new')).toEqual({ from: 'new' })
			// Source takes precedence on conflicting ids
			expect(merged.get('shared')).toEqual({ from: 'old' })
			// Source table is dropped after the merge
			expect(cache.tableExists('src')).toBe(false)
		} finally {
			cache.close()
		}
	})

	test('is a no-op when the source table does not exist', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			expect(() => cache.renameTable('missing_src', 'missing_dst')).not.toThrow()
			expect(cache.tableExists('missing_dst')).toBe(false)
		} finally {
			cache.close()
		}
	})

	test('evicts the old table from the view cache', () => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			const old = cache.getTableView<Record<string, number>>('cached_old')
			old.set('a', 1)
			cache.renameTable('cached_old', 'cached_new')

			// A fresh view for the old name is created lazily (recreating an empty table), so it is a new instance
			expect(cache.getTableView('cached_old')).not.toBe(old)
		} finally {
			cache.close()
		}
	})

	test.each([
		['', 'valid'],
		['valid', ''],
		[123 as any, 'valid'],
		['valid', 123 as any],
	])('rejects invalid table names (%s -> %s)', (from, to) => {
		const cache = new DataCache(':memory:', noopObserver)
		try {
			expect(() => cache.renameTable(from, to)).toThrow(/Invalid (old|new) table name/)
		} finally {
			cache.close()
		}
	})
})

describe('DataStoreBase disk persistence', () => {
	let tmpDir: string

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-storebase-'))
	})
	afterEach(() => {
		// Best-effort: Windows can hold a lock on a just-closed SQLite file, making removal EPERM
		try {
			fs.removeSync(tmpDir)
		} catch {
			// temp dir will be reaped by the OS
		}
		vi.restoreAllMocks()
	})

	test('creates a fresh database file on first run and flags it', () => {
		const cache = new DataCache(tmpDir, noopObserver)
		try {
			expect(cache.getIsFirstRun()).toBe(true)
			expect(fs.existsSync(path.join(tmpDir, 'cache.sqlite'))).toBe(true)
		} finally {
			cache.close()
		}
	})

	test('reopens an existing database, preserving data and clearing the first-run flag', () => {
		const first = new DataCache(tmpDir, noopObserver)
		first.getTableView<Record<string, { hello: string }>>('persist').set('k', { hello: 'world' })
		first.close()

		const second = new DataCache(tmpDir, noopObserver)
		try {
			expect(second.getIsFirstRun()).toBe(false)
			expect(second.getTableView<Record<string, { hello: string }>>('persist').get('k')).toEqual({ hello: 'world' })
		} finally {
			second.close()
		}
	})

	// Cross-platform: the store closes its handle on the unreadable file before renaming it aside, so
	// the quarantine works even on Windows (where an open handle would lock the file).
	test('quarantines a corrupt database file and resets to a working store', () => {
		// Suppress the expected console.error from the reset path
		const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

		const cfgFile = path.join(tmpDir, 'cache.sqlite')
		fs.writeFileSync(cfgFile, 'this is not a valid sqlite database')

		const cache = new DataCache(tmpDir, noopObserver)
		try {
			// The unreadable file is moved aside and a fresh, working database takes its place
			expect(fs.existsSync(path.join(tmpDir, 'cache.corrupt'))).toBe(true)
			const view = cache.getTableView<Record<string, number>>('after_reset')
			view.set('a', 1)
			expect(view.get('a')).toBe(1)
			expect(errSpy).toHaveBeenCalled()
		} finally {
			cache.close()
		}
	})

	test('recovers from the backup file when the main database is missing', () => {
		// Build a valid database, then simulate a crash that left only the backup behind
		const seed = new DataCache(tmpDir, noopObserver)
		seed.getTableView<Record<string, { recovered: boolean }>>('data').set('k', { recovered: true })
		seed.close()

		const cfgFile = path.join(tmpDir, 'cache.sqlite')
		const bakFile = path.join(tmpDir, 'cache.sqlite.bak')
		fs.copyFileSync(cfgFile, bakFile)
		fs.rmSync(cfgFile)

		const recovered = new DataCache(tmpDir, noopObserver)
		try {
			expect(fs.existsSync(cfgFile)).toBe(true) // restored from the backup
			expect(recovered.getTableView<Record<string, { recovered: boolean }>>('data').get('k')).toEqual({
				recovered: true,
			})
		} finally {
			recovered.close()
		}
	})
})

describe('DataDatabase', () => {
	let tmpDir: string

	beforeEach(() => {
		tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'companion-db-'))
	})
	afterEach(() => {
		// Best-effort: Windows can hold a lock on a just-closed SQLite file, making removal EPERM
		try {
			fs.removeSync(tmpDir)
		} catch {
			// temp dir will be reaped by the OS
		}
	})

	test('createBackup writes a non-empty, openable copy of the database', async () => {
		const db = new DataDatabase(tmpDir, noopObserver)
		try {
			db.getTableView<Record<string, { n: number }>>('backup_me').set('k', { n: 5 })

			const backupPath = path.join(tmpDir, 'manual-backup.sqlite')
			const size = await db.createBackup(backupPath)

			expect(size).toBeGreaterThan(0)
			expect(fs.existsSync(backupPath)).toBe(true)

			// The backup is a usable SQLite database containing the data we wrote
			const reopened = new DatabaseSync(backupPath)
			try {
				const row = reopened.prepare('SELECT value FROM backup_me WHERE id = ?').get('k') as
					{ value: string } | undefined
				expect(row).toBeDefined()
				expect(JSON.parse(row!.value)).toEqual({ n: 5 })
			} finally {
				reopened.close()
			}
		} finally {
			db.close()
		}
	})

	test('seeds the page config version and first-run flag on a fresh database', () => {
		const db = new DataDatabase(tmpDir, noopObserver)
		try {
			expect(db.getIsFirstRun()).toBe(true)
			expect(typeof db.defaultTableView.get('page_config_version')).toBe('number')
		} finally {
			db.close()
		}
	})
})
