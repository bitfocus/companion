import type { DatabaseSync, StatementSync } from 'node:sqlite'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { Logger } from '../Log/Controller.js'

/**
 * The kinds of row-level operation a DataStoreTableView performs, used as a metrics label.
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
interface DataStoreTableViewHooks {
	/** Mark the database as having unsaved changes. */
	onDirty: () => void
	/** Report the timing of a completed operation (table is filled in by the store). */
	onOperation: (operation: DatabaseOperation, seconds: number) => void
}

type ValueIfJsonEncodable<T> = T extends number | { [key: string]: any } ? T : never
type ValueIfString<T> = T extends string ? T : never

export class DataStoreTableView<TableContent extends Record<string, any>> {
	readonly #logger: Logger

	readonly #store: DatabaseSync
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
		this.#logger = logger.child({ source: tableName })
		this.#store = store
		this.tableName = tableName
		this.#hooks = hooks

		// Ensure the table exists
		this.#store.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (id STRING UNIQUE, value STRING);`).run()

		this.#deleteByIdQuery = this.#store.prepare(`DELETE FROM ${tableName} WHERE id = @id`)
		this.#emptyTableQuery = this.#store.prepare(`DELETE FROM ${tableName}`)
		this.#getAllQuery = this.#store.prepare(`SELECT id, value FROM ${tableName}`)
		this.#getByIdQuery = this.#store.prepare(`SELECT value FROM ${tableName} WHERE id = @id`)
		this.#setByIdQuery = this.#store.prepare(
			`INSERT INTO ${tableName} (id, value) VALUES (@id, @value) ON CONFLICT(id) DO UPDATE SET value = @value`
		)
	}

	private validateKey(key: string | number | symbol): asserts key is string {
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

	/** Snapshot of this table's accumulated operation and error counts, for metrics. */
	collectOperationStats(): TableOperationStats {
		return {
			table: this.tableName,
			counts: { ...this.#opCounts },
			errors: { ...this.#opErrors },
		}
	}

	/**
	 * Get all rows from the table
	 */
	all(): TableContent {
		// TODO - how to make this safe for json vs string?

		const out: TableContent = {} as any

		this.#logger.silly(`Get table`)

		try {
			const rows = this.#runOp('get_all', () => this.#getAllQuery.all())
			for (const record of rows) {
				try {
					// @ts-expect-error can't use as index
					out[record.id] = JSON.parse(record.value)
				} catch (_e) {
					// @ts-expect-error can't use as index
					out[record.id] = record.value
				}
			}
		} catch (e) {
			this.#logger.warn(`Error getting: ${stringifyError(e)}`)
		}

		return out
	}

	private getTableKeyRaw(key: string): string | undefined {
		this.#logger.silly(`Get table key: ${key}`)

		try {
			const row = this.#runOp('get', () => this.#getByIdQuery.get({ id: key }))
			return row?.value as string | undefined
		} catch (e) {
			this.#logger.warn(`Error getting ${key}: ${stringifyError(e)}`)
			return undefined
		}
	}

	/**
	 * Save/update a key/value pair to a table
	 * @param key - the key to save under
	 * @param value - the object to save
	 */
	private setTableKeyRaw(key: string, value: string): void {
		this.#logger.silly(`Set table key ${key} - ${value}`)

		try {
			this.#runOp('set', () => this.#setByIdQuery.run({ id: key, value: value }))
		} catch (e) {
			this.#logger.warn(`Error updating ${key}: ${stringifyError(e)}`)
		}

		this.#hooks.onDirty()
	}

	/**
	 * Get a value from the table
	 * @param id - the key to be retrieved
	 */
	get<T extends keyof TableContent>(id: T): ValueIfJsonEncodable<TableContent[T]> | undefined {
		this.validateKey(id)

		const value = this.getTableKeyRaw(id)
		if (!value) return undefined

		try {
			return JSON.parse(value)
		} catch (e) {
			this.#logger.warn(`Error parsing ${id}: ${stringifyError(e)}`)
			return undefined
		}
	}

	/**
	 * Get a value from the table or set a default value
	 * @param id - the key to be retrieved
	 * @param defaultValue - the default value to store if the key doesn't exist
	 */
	getOrDefault<T extends keyof TableContent>(
		id: T,
		defaultValue: ValueIfJsonEncodable<TableContent[T]>
	): ValueIfJsonEncodable<TableContent[T]> {
		this.validateKey(id)

		const value = this.getTableKeyRaw(id)
		if (value === undefined) {
			this.setTableKeyRaw(id, JSON.stringify(defaultValue))
			return defaultValue
		}

		try {
			return JSON.parse(value)
		} catch (e) {
			this.#logger.warn(`Error parsing ${String(id)}: ${stringifyError(e)}`)
			return defaultValue
		}
	}

	/**
	 * Get a value from the table or set a default value
	 * @param id - the key to be retrieved
	 * @param defaultValue - the default value to store if the key doesn't exist
	 */
	getPrimitiveOrDefault<T extends keyof TableContent>(
		id: T,
		defaultValue: ValueIfString<TableContent[T]>
	): ValueIfString<TableContent[T]> {
		this.validateKey(id)

		const value = this.getTableKeyRaw(id)
		if (value === undefined) {
			this.setTableKeyRaw(id, defaultValue)
			return defaultValue
		}
		return value as any // The types match, but TS doesn't know that
	}

	/**
	 * Set a value in the table
	 * @param id - the key to be set
	 * @param value - the value to be set
	 */
	set<T extends keyof TableContent>(id: T, value: ValueIfJsonEncodable<TableContent[T]>): void {
		this.validateKey(id)

		this.setTableKeyRaw(id, JSON.stringify(value))
	}

	/**
	 * Set a value in the table
	 * @param id - the key to be set
	 * @param value - the value to be set
	 */
	setPrimitive<T extends keyof TableContent>(id: T, value: ValueIfString<TableContent[T]>): void {
		this.validateKey(id)

		this.setTableKeyRaw(id, value)
	}

	/**
	 * Delete a value from the table
	 * @param id - the key to be deleted
	 */
	delete(id: keyof TableContent): void {
		this.validateKey(id)

		this.#logger.silly(`Delete key: ${id}`)

		try {
			this.#runOp('delete', () => this.#deleteByIdQuery.run({ id }))
		} catch (e) {
			this.#logger.warn(`Error deleting ${id}: ${stringifyError(e)}`)
		}

		this.#hooks.onDirty()
	}

	/**
	 * Clear all values from the table
	 */
	clear(): void {
		this.#logger.silly(`Empty table`)

		try {
			this.#runOp('clear', () => this.#emptyTableQuery.run())
		} catch (e) {
			this.#logger.warn(`Error emptying: ${stringifyError(e)}`)
		}

		this.#hooks.onDirty()
	}
}
