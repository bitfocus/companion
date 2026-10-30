import type { DatabaseSync } from 'node:sqlite'
import type z from 'zod'
import type { Logger } from '../../Log/Controller.js'
import {
	DataStoreParsedTableViewBase,
	type BrokenRowRecord,
	type SchemaTableViewRepair,
} from './ParsedTableViewBase.js'
import type { DataStoreTableView } from './TableView.js'
import type { DataStoreTableViewHooks } from './TableViewBase.js'

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
> extends DataStoreParsedTableViewBase {
	readonly schema: TSchema
	readonly validateWrites: boolean
	readonly repair: SchemaTableViewRepair | undefined

	constructor(
		logger: Logger,
		store: DatabaseSync,
		tableName: string,
		hooks: DataStoreTableViewHooks,
		brokenRows: DataStoreTableView<Record<string, BrokenRowRecord>>,
		schema: TSchema,
		options: SchemaTableViewOptions | undefined
	) {
		super(logger, store, tableName, hooks, brokenRows)

		this.schema = schema
		this.validateWrites = options?.validateWrites ?? true
		this.repair = options?.repair
	}

	/**
	 * Get all valid rows from the table
	 */
	all(): Record<string, z.output<TSchema>> {
		const out: Record<string, z.output<TSchema>> = {}

		for (const [id, rawValue] of Object.entries(this.allRaw())) {
			const value = this.parseRow(id, rawValue, this.schema, this.repair)
			if (value !== undefined) out[id] = value
		}

		return out
	}

	/**
	 * Get a value from the table, if it exists and is valid
	 * @param id - the key to be retrieved
	 */
	get(id: string): z.output<TSchema> | undefined {
		this.validateKey(id)

		const rawValue = this.getRaw(id)
		if (rawValue === undefined) return undefined

		return this.parseRow(id, rawValue, this.schema, this.repair)
	}

	/**
	 * Set a value in the table. When writes are validated, it is normalised by the schema
	 * @param id - the key to be set
	 * @param value - the value to be set
	 * @returns the value that was stored
	 * @throws if writes are validated and the value does not match the schema
	 */
	set(id: string, value: z.output<TSchema>): z.output<TSchema> {
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
	delete(id: string): void {
		this.validateKey(id)

		this.deleteRaw(id)
	}
}
