import type { DatabaseSync } from 'node:sqlite'
import { nanoid } from 'nanoid'
import z from 'zod'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreTableView } from '../TableView.js'
import { DataStoreTableViewBase, type DataStoreTableViewHooks } from '../TableViewBase.js'

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

export type SchemaTableViewRepair = (
	row: unknown,
	issues: readonly z.core.$ZodIssue[]
) => { row: unknown; repairs: string[] } | null

/** A repair can reveal more to repair, so it is given a few attempts */
const MAX_REPAIR_ATTEMPTS = 3

/**
 * A table view whose rows are parsed with a schema when read, to fill in defaults and normalise their shape.
 * Rows that fail to parse are repaired if possible, else moved to {@link BROKEN_ROWS_TABLE}.
 */
export abstract class DataStoreParsedTableViewBase extends DataStoreTableViewBase {
	readonly #brokenRows: DataStoreTableView<Record<string, BrokenRowRecord>>

	constructor(
		logger: Logger,
		store: DatabaseSync,
		tableName: string,
		hooks: DataStoreTableViewHooks,
		brokenRows: DataStoreTableView<Record<string, BrokenRowRecord>>
	) {
		super(logger, store, tableName, hooks)

		this.#brokenRows = brokenRows
	}

	/**
	 * Check a value as it will be stored, and store what the schema makes of it
	 * @throws if the value does not match the schema
	 */
	protected setParsed<TSchema extends z.ZodType>(
		id: string,
		schema: TSchema,
		value: z.output<TSchema>
	): z.output<TSchema> {
		// Encoding drops undefined properties and turns values like NaN into null, which the schema may accept
		const result = schema.safeParse(JSON.parse(JSON.stringify(value)))
		if (!result.success) {
			throw new Error(`Invalid value for "${this.tableName}" row "${id}": ${z.prettifyError(result.error)}`)
		}

		this.setRaw(id, JSON.stringify(result.data))

		return result.data
	}

	/**
	 * Parse a stored row, repairing it or else moving it to {@link BROKEN_ROWS_TABLE} if it fails
	 * @returns the parsed row, or undefined if it failed
	 */
	protected parseRow<TSchema extends z.ZodType>(
		id: string,
		rawValue: string,
		schema: TSchema,
		repair: SchemaTableViewRepair | undefined
	): z.output<TSchema> | undefined {
		let reason: string
		try {
			const row: unknown = JSON.parse(rawValue)
			const result = schema.safeParse(row)
			if (result.success) return result.data

			reason = z.prettifyError(result.error)

			const repaired = this.#repair(id, row, result.error, schema, repair)
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
	#repair<TSchema extends z.ZodType>(
		id: string,
		row: unknown,
		error: z.ZodError,
		schema: TSchema,
		repair: SchemaTableViewRepair | undefined
	): z.output<TSchema> | undefined {
		if (!repair) return undefined

		const repairs: string[] = []
		let current = row
		let issues = error.issues
		for (let attempt = 0; attempt < MAX_REPAIR_ATTEMPTS; attempt++) {
			const repaired = repair(current, issues)
			if (!repaired) return undefined

			repairs.push(...repaired.repairs)
			current = repaired.row

			const result = schema.safeParse(current)
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
