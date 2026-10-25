import type { DatabaseSync } from 'node:sqlite'
import type z from 'zod'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreTableView } from '../TableView.js'
import type { DataStoreTableViewHooks } from '../TableViewBase.js'
import {
	DataStoreParsedTableViewBase,
	type BrokenRowRecord,
	type SchemaTableViewRepair,
} from './ParsedTableViewBase.js'

/** The schema of each row of a keyed table, by its key */
export type KeyedRowSchemas = Record<string, z.ZodType>

export interface KeyedSchemaTableViewOptions<TRows extends KeyedRowSchemas> {
	/** Repair a row that fails to parse, by its key. See {@link SchemaTableViewOptions.repair} */
	repair?: { [K in keyof TRows]?: SchemaTableViewRepair }
}

/**
 * A view of a table with a fixed set of rows, each parsed with its own schema. Writes are always validated.
 * Every row schema must have a default, which is given for a row that is missing, or that fails to parse and is
 * moved to the broken rows. Rows without a schema are ignored.
 */
export class DataStoreKeyedSchemaTableView<TRows extends KeyedRowSchemas> extends DataStoreParsedTableViewBase {
	readonly schemas: TRows
	readonly repair: KeyedSchemaTableViewOptions<TRows>['repair']

	constructor(
		logger: Logger,
		store: DatabaseSync,
		tableName: string,
		hooks: DataStoreTableViewHooks,
		brokenRows: DataStoreTableView<Record<string, BrokenRowRecord>>,
		schemas: TRows,
		options: KeyedSchemaTableViewOptions<TRows> | undefined
	) {
		super(logger, store, tableName, hooks, brokenRows)

		for (const [key, schema] of Object.entries(schemas)) {
			if (!schema.safeParse(undefined).success) throw new Error(`Row "${key}" of "${tableName}" has no default`)
		}

		this.schemas = schemas
		this.repair = options?.repair
	}

	/**
	 * Get a row, or its default if it is missing or invalid
	 * @param key - the row to be retrieved
	 */
	get<K extends keyof TRows & string>(key: K): z.output<TRows[K]> {
		const schema = this.#schemaFor(key)

		const rawValue = this.getRaw(key)
		if (rawValue !== undefined) {
			const value = this.parseRow(key, rawValue, schema, this.repair?.[key])
			if (value !== undefined) return value
		}

		return schema.parse(undefined)
	}

	/**
	 * Set a row, normalised by its schema
	 * @param key - the row to be set
	 * @param value - the value to be set
	 * @returns the value that was stored
	 * @throws if the value does not match the schema
	 */
	set<K extends keyof TRows & string>(key: K, value: z.output<TRows[K]>): z.output<TRows[K]> {
		return this.setParsed(key, this.#schemaFor(key), value)
	}

	/**
	 * Delete a row, so it reads as its default
	 * @param key - the row to be deleted
	 */
	delete(key: keyof TRows & string): void {
		this.#schemaFor(key)

		this.deleteRaw(key)
	}

	#schemaFor<K extends keyof TRows & string>(key: K): TRows[K] {
		this.validateKey(key)

		const schema = this.schemas[key] as TRows[K] | undefined
		if (!schema) throw new Error(`"${this.tableName}" has no row "${key}"`)
		return schema
	}
}
