import type { DatabaseSync } from 'node:sqlite'
import z from 'zod'
import type { Logger } from '../../Log/Controller.js'
import {
	DataStoreParsedTableViewBase,
	type BrokenRowRecord,
	type SchemaTableViewRepair,
} from './ParsedTableViewBase.js'
import type { DataStoreTableView } from './TableView.js'
import type { DataStoreTableViewHooks } from './TableViewBase.js'

export interface SchemaTableViewKey<TKey extends string, TRow> {
	/** The schema every key must match */
	schema: z.ZodType<TKey>
	/** Why a key doesn't suit its row, or null when it does */
	matchesRow(key: TKey, row: TRow): string | null
}

/** Accepts any key */
export const ANY_SCHEMA_TABLE_KEY: SchemaTableViewKey<string, unknown> = {
	schema: z.string(),
	matchesRow: () => null,
}

export interface SchemaTableViewOptions {
	/**
	 * Whether rows are checked against the schema when written, as well as when read. Turn off for tables whose
	 * rows are large and written often, where the check costs more than it is worth. Defaults to true
	 */
	validateWrites?: boolean

	/**
	 * Repair a row that fails to parse, from the issues found, instead of moving it to the broken rows table.
	 * A repaired row which then parses is stored, and each repair logged. Return null if it can't be repaired
	 */
	repair?: SchemaTableViewRepair
}

/**
 * A view of a table whose rows all share a schema.
 * The schema must accept its own output, as written rows are parsed again when read.
 */
export class DataStoreSchemaTableView<
	TSchema extends z.ZodType<Record<string, any>>,
	TKey extends string,
> extends DataStoreParsedTableViewBase {
	readonly schema: TSchema
	readonly validateWrites: boolean
	readonly repair: SchemaTableViewRepair | undefined
	/** Checked as each row is read. A row whose key fails is moved to the broken rows table */
	readonly key: SchemaTableViewKey<TKey, z.output<TSchema>>

	constructor(
		logger: Logger,
		store: DatabaseSync,
		tableName: string,
		hooks: DataStoreTableViewHooks,
		brokenRows: DataStoreTableView<Record<string, BrokenRowRecord>>,
		schema: TSchema,
		key: SchemaTableViewKey<TKey, z.output<TSchema>>,
		options: SchemaTableViewOptions | undefined
	) {
		super(logger, store, tableName, hooks, brokenRows)

		this.schema = schema
		this.key = key
		this.validateWrites = options?.validateWrites ?? true
		this.repair = options?.repair
	}

	/**
	 * Get all valid rows from the table
	 */
	all(): Record<string, z.output<TSchema>> {
		return Object.fromEntries(this.entries())
	}

	/**
	 * Get all valid rows from the table, with their keys
	 */
	entries(): Array<[TKey, z.output<TSchema>]> {
		const out: Array<[TKey, z.output<TSchema>]> = []

		for (const [id, rawValue] of Object.entries(this.allRaw())) {
			const entry = this.#parseEntry(id, rawValue)
			if (entry) out.push(entry)
		}

		return out
	}

	/**
	 * Get a value from the table, if it exists and is valid
	 * @param id - the key to be retrieved
	 */
	get(id: TKey): z.output<TSchema> | undefined {
		this.validateKey(id)

		const rawValue = this.getRaw(id)
		if (rawValue === undefined) return undefined

		return this.#parseEntry(id, rawValue)?.[1]
	}

	/** Parse a stored row and check its key, moving it to the broken rows table if either fails */
	#parseEntry(id: string, rawValue: string): [TKey, z.output<TSchema>] | undefined {
		const value = this.parseRow(id, rawValue, this.schema, this.repair)
		if (value === undefined) return undefined

		const key = this.key.schema.safeParse(id)
		if (!key.success) {
			this.moveToBroken(id, rawValue, `Invalid key: ${z.prettifyError(key.error)}`)
			return undefined
		}

		const mismatch = this.key.matchesRow(key.data, value)
		if (mismatch !== null) {
			this.moveToBroken(id, rawValue, mismatch)
			return undefined
		}

		return [key.data, value]
	}

	/**
	 * Set a value in the table. When writes are validated, it is normalised by the schema
	 * @param id - the key to be set
	 * @param value - the value to be set
	 * @returns the value that was stored
	 * @throws if writes are validated and the value does not match the schema
	 */
	set(id: TKey, value: z.output<TSchema>): z.output<TSchema> {
		this.validateKey(id)

		if (!this.validateWrites) {
			this.setRaw(id, JSON.stringify(value))
			return value
		}

		return this.setParsed(id, this.schema, value)
	}

	/**
	 * Delete a value from the table
	 * @param id - the key to be deleted
	 */
	delete(id: TKey): void {
		this.validateKey(id)

		this.deleteRaw(id)
	}
}
