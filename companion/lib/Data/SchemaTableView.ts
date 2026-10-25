import type { DatabaseSync } from 'node:sqlite'
import { nanoid } from 'nanoid'
import z from 'zod'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { Logger } from '../Log/Controller.js'
import type { DataStoreTableView } from './TableView.js'
import { DataStoreTableViewBase, type DataStoreTableViewHooks } from './TableViewBase.js'

/** Table that rows failing their schema are moved to, so they aren't lost */
export const BROKEN_ROWS_TABLE = 'broken_rows'

export interface BrokenRowRecord {
	/** The table the row was removed from */
	table: string
	/** The id of the row in that table */
	rowId: string
	/** The value as it was stored */
	value: string
	/** Why the row failed to parse */
	reason: string
	/** When the row was removed */
	timestamp: number
}

export interface SchemaTableViewOptions {
	/**
	 * Whether rows are checked against the schema when written, as well as when read. Turn off for tables whose
	 * rows are large and written often, where the check costs more than it is worth. Defaults to true
	 */
	validateWrites?: boolean

	/**
	 * Repair a row that fails to parse, from the issues found, instead of moving it to {@link BROKEN_ROWS_TABLE}.
	 * A repaired row which then parses is stored, and each repair logged. Return null if it can't be repaired
	 */
	repair?: SchemaTableViewRepair
}

export type SchemaTableViewRepair = (
	row: unknown,
	issues: readonly z.core.$ZodIssue[]
) => { row: unknown; repairs: string[] } | null

/** A repair can reveal more to repair, so it is given a few attempts */
const MAX_REPAIR_ATTEMPTS = 3

/**
 * A view of a table whose rows are parsed with a schema, to fill in defaults and normalise their shape.
 * The schema must accept its own output, as written rows are parsed again when read.
 * Rows that fail to parse when read are moved to {@link BROKEN_ROWS_TABLE}.
 */
export class DataStoreSchemaTableView<TSchema extends z.ZodType<Record<string, any>>> extends DataStoreTableViewBase {
	readonly schema: TSchema
	readonly validateWrites: boolean
	readonly repair: SchemaTableViewRepair | undefined
	readonly #brokenRows: DataStoreTableView<Record<string, BrokenRowRecord>>

	constructor(
		logger: Logger,
		store: DatabaseSync,
		tableName: string,
		hooks: DataStoreTableViewHooks,
		brokenRows: DataStoreTableView<Record<string, BrokenRowRecord>>,
		schema: TSchema,
		options: SchemaTableViewOptions | undefined
	) {
		super(logger, store, tableName, hooks)

		this.#brokenRows = brokenRows
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
			const value = this.#parse(id, rawValue)
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

		return this.#parse(id, rawValue)
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

		// Check the value as it will be stored, so that this agrees with reading it back.
		// Encoding drops undefined properties and turns values like NaN into null, which the schema may accept
		const result = this.schema.safeParse(JSON.parse(JSON.stringify(value)))
		if (!result.success) {
			throw new Error(`Invalid value for "${this.tableName}" row "${id}": ${z.prettifyError(result.error)}`)
		}

		this.setRaw(id, JSON.stringify(result.data))

		return result.data
	}

	/**
	 * Delete a value from the table
	 * @param id - the key to be deleted
	 */
	delete(id: string): void {
		this.validateKey(id)

		this.deleteRaw(id)
	}

	#parse(id: string, rawValue: string): z.output<TSchema> | undefined {
		let reason: string
		try {
			const row: unknown = JSON.parse(rawValue)
			const result = this.schema.safeParse(row)
			if (result.success) return result.data

			reason = z.prettifyError(result.error)

			const repaired = this.#repair(id, row, result.error)
			if (repaired !== undefined) return repaired
		} catch (e) {
			reason = `Invalid JSON: ${stringifyError(e)}`
		}

		const moved = this.#brokenRows.set(nanoid(), {
			table: this.tableName,
			rowId: id,
			value: rawValue,
			reason,
			timestamp: Date.now(),
		})
		if (moved) {
			this.logger.error(`Moved invalid row "${id}" to ${BROKEN_ROWS_TABLE}: ${reason}`)
			this.deleteRaw(id)
		} else {
			// Leave it in place rather than lose the only copy
			this.logger.error(`Ignoring invalid row "${id}", unable to move it to ${BROKEN_ROWS_TABLE}: ${reason}`)
		}

		return undefined
	}

	/** Try to repair a row that failed to parse, storing it if that succeeds */
	#repair(id: string, row: unknown, error: z.ZodError): z.output<TSchema> | undefined {
		if (!this.repair) return undefined

		const repairs: string[] = []
		let current = row
		let issues = error.issues
		for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt++) {
			const repaired = this.repair(current, issues)
			if (!repaired) return undefined

			repairs.push(...repaired.repairs)
			current = repaired.row

			const result = this.schema.safeParse(current)
			if (result.success) {
				this.setRaw(id, JSON.stringify(result.data))
				for (const repair of repairs) this.logger.warn(`Repaired row "${id}": ${repair}`)
				return result.data
			}
			issues = result.error.issues
		}

		return undefined
	}
}
