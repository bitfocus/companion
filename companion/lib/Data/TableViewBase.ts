import type { DatabaseSync, StatementSync } from 'node:sqlite'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { Logger } from '../Log/Controller.js'

/**
 * The kinds of row-level operation a table view performs, used as a metrics label.
 * `get` = point read, `get_all` = full-table read, `set` = insert/update, `delete`/`clear` = removals.
 */
export type DatabaseOperation = 'get' | 'get_all' | 'set' | 'delete' | 'clear'

export const DATABASE_OPERATIONS: DatabaseOperation[] = ['get', 'get_all', 'set', 'delete', 'clear']

/** Per-table operation and error counts, accumulated over the process lifetime for metrics. */
export interface TableOperationStats {
	table: string
	counts: Record<DatabaseOperation, number>
	errors: Record<DatabaseOperation, number>
}

/** Callbacks a table view invokes back into its owning store. */
export interface DataStoreTableViewHooks {
	/** Mark the database as having unsaved changes. */
	onDirty: () => void
	/** Report the timing of a completed operation (table is filled in by the store). */
	onOperation: (operation: DatabaseOperation, seconds: number) => void
}

/**
 * The storage of a table view: rows are string values keyed by id.
 * Subclasses decide how values are encoded and decoded.
 */
export abstract class DataStoreTableViewBase {
	protected readonly logger: Logger

	readonly tableName: string
	readonly #hooks: DataStoreTableViewHooks

	readonly #opCounts: Record<DatabaseOperation, number> = { get: 0, get_all: 0, set: 0, delete: 0, clear: 0 }
	readonly #opErrors: Record<DatabaseOperation, number> = { get: 0, get_all: 0, set: 0, delete: 0, clear: 0 }

	readonly #deleteByIdQuery: StatementSync
	readonly #emptyTableQuery: StatementSync
	readonly #getAllQuery: StatementSync
	readonly #getByIdQuery: StatementSync
	readonly #setByIdQuery: StatementSync

	constructor(logger: Logger, store: DatabaseSync, tableName: string, hooks: DataStoreTableViewHooks) {
		this.logger = logger.child({ source: tableName })
		this.tableName = tableName
		this.#hooks = hooks

		// Ensure the table exists
		store.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (id STRING UNIQUE, value STRING);`).run()

		this.#deleteByIdQuery = store.prepare(`DELETE FROM ${tableName} WHERE id = @id`)
		this.#emptyTableQuery = store.prepare(`DELETE FROM ${tableName}`)
		this.#getAllQuery = store.prepare(`SELECT id, value FROM ${tableName}`)
		this.#getByIdQuery = store.prepare(`SELECT value FROM ${tableName} WHERE id = @id`)
		this.#setByIdQuery = store.prepare(
			`INSERT INTO ${tableName} (id, value) VALUES (@id, @value) ON CONFLICT(id) DO UPDATE SET value = @value`
		)
	}

	protected validateKey(key: string | number | symbol): asserts key is string {
		if (!key || typeof key !== 'string') throw new Error(`Invalid key for "${this.tableName}": ${String(key)}`)
	}

	/**
	 * Run a single SQLite statement, recording its count, timing, and (on throw) error against the operation.
	 * Rethrows so the caller's existing error handling still logs and falls back.
	 */
	#runOp<T>(operation: DatabaseOperation, fn: () => T): T {
		const start = process.hrtime.bigint()
		try {
			const result = fn()
			this.#opCounts[operation]++
			return result
		} catch (e) {
			this.#opErrors[operation]++
			throw e
		} finally {
			this.#hooks.onOperation(operation, Number(process.hrtime.bigint() - start) / 1e9)
		}
	}

	/** Snapshot of this view's accumulated operation and error counts, for metrics. */
	collectOperationStats(): TableOperationStats {
		return {
			table: this.tableName,
			counts: { ...this.#opCounts },
			errors: { ...this.#opErrors },
		}
	}

	/**
	 * Get all rows from the table, without decoding their values
	 */
	protected allRaw(): Record<string, string> {
		const out: Record<string, string> = {}

		this.logger.silly(`Get table`)

		try {
			const rows = this.#runOp('get_all', () => this.#getAllQuery.all())
			for (const record of rows) {
				out[record.id as string] = record.value as string
			}
		} catch (e) {
			this.logger.warn(`Error getting: ${stringifyError(e)}`)
		}

		return out
	}

	/**
	 * Get a value from the table, without decoding it
	 * @param key - the key to be retrieved
	 */
	protected getRaw(key: string): string | undefined {
		this.logger.silly(`Get table key: ${key}`)

		try {
			const row = this.#runOp('get', () => this.#getByIdQuery.get({ id: key }))
			return row?.value as string | undefined
		} catch (e) {
			this.logger.warn(`Error getting ${key}: ${stringifyError(e)}`)
			return undefined
		}
	}

	/**
	 * Save/update an already encoded value in the table
	 * @param key - the key to save under
	 * @param value - the encoded value
	 * @returns whether the value was written
	 */
	protected setRaw(key: string, value: string): boolean {
		this.logger.silly(`Set table key ${key} - ${value}`)

		let success = false
		try {
			this.#runOp('set', () => this.#setByIdQuery.run({ id: key, value: value }))
			success = true
		} catch (e) {
			this.logger.warn(`Error updating ${key}: ${stringifyError(e)}`)
		}

		this.#hooks.onDirty()

		return success
	}

	/**
	 * Delete a value from the table
	 * @param key - the key to be deleted
	 */
	protected deleteRaw(key: string): void {
		this.logger.silly(`Delete key: ${key}`)

		try {
			this.#runOp('delete', () => this.#deleteByIdQuery.run({ id: key }))
		} catch (e) {
			this.logger.warn(`Error deleting ${key}: ${stringifyError(e)}`)
		}

		this.#hooks.onDirty()
	}

	/**
	 * Clear all values from the table
	 */
	clear(): void {
		this.logger.silly(`Empty table`)

		try {
			this.#runOp('clear', () => this.#emptyTableQuery.run())
		} catch (e) {
			this.logger.warn(`Error emptying: ${stringifyError(e)}`)
		}

		this.#hooks.onDirty()
	}
}
