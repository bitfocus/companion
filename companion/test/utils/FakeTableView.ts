import type z from 'zod'
import type { DataDatabase } from '../../lib/Data/Database.js'
import type { KeyedRowSchemas, KeyedSchemaTableViewOptions } from '../../lib/Data/Tables/KeyedSchemaTableView.js'
import type { SchemaTableViewOptions } from '../../lib/Data/Tables/SchemaTableView.js'
import type { DataStoreTableView } from '../../lib/Data/Tables/TableView.js'

/**
 * A Map-backed stand-in for DataStoreTableView.
 * Values are cloned on read and write, mirroring the JSON round-trip of the real SQLite table,
 * so `data` can be used to assert exactly what would have been persisted.
 */
export class FakeTableView<T> {
	data: Record<string, T> = {}

	all(): Record<string, T> {
		return structuredClone(this.data)
	}

	get(key: string): T | undefined {
		return structuredClone(this.data[key])
	}

	getOrDefault(key: string, defaultValue: T): T {
		if (this.data[key] === undefined) {
			this.data[key] = structuredClone(defaultValue)
			return defaultValue
		}
		return structuredClone(this.data[key])
	}

	set(key: string, value: T): void {
		this.data[key] = structuredClone(value)
	}

	delete(key: string): void {
		delete this.data[key]
	}

	clear(): void {
		this.data = {}
	}

	asTableView(): DataStoreTableView<Record<string, T>> {
		return this as unknown as DataStoreTableView<Record<string, T>>
	}
}

/**
 * A stand-in for DataStoreSchemaTableView, storing its rows in a FakeTableView.
 * Rows are parsed with the schema on read and write like the real view. A row that fails is repaired and stored like
 * the real view, else it is skipped on read but left in place.
 */
export class FakeSchemaTableView<TSchema extends z.ZodType<Record<string, any>>> {
	readonly table: FakeTableView<unknown>
	readonly schema: TSchema
	readonly validateWrites: boolean
	readonly repair: SchemaTableViewOptions['repair']

	constructor(table: FakeTableView<unknown>, schema: TSchema, options?: SchemaTableViewOptions) {
		this.table = table
		this.schema = schema
		this.validateWrites = options?.validateWrites ?? true
		this.repair = options?.repair
	}

	all(): Record<string, z.output<TSchema>> {
		const out: Record<string, z.output<TSchema>> = {}
		for (const [key, value] of Object.entries(this.table.all())) {
			const parsed = this.#parse(key, value)
			if (parsed !== undefined) out[key] = parsed
		}
		return out
	}

	get(key: string): z.output<TSchema> | undefined {
		return this.#parse(key, this.table.get(key))
	}

	#parse(key: string, value: unknown): z.output<TSchema> | undefined {
		let result = this.schema.safeParse(value)
		if (!result.success && this.repair) {
			const repaired = this.repair(value, result.error.issues)
			if (repaired) {
				result = this.schema.safeParse(repaired.row)
				if (result.success) this.table.set(key, result.data)
			}
		}
		return result.success ? result.data : undefined
	}

	set(key: string, value: z.output<TSchema>): z.output<TSchema> {
		if (!this.validateWrites) {
			this.table.set(key, value)
			return value
		}

		const parsed = this.schema.parse(JSON.parse(JSON.stringify(value)))
		this.table.set(key, parsed)
		return structuredClone(parsed)
	}

	delete(key: string): void {
		this.table.delete(key)
	}

	clear(): void {
		this.table.clear()
	}
}

/**
 * A stand-in for DataStoreKeyedSchemaTableView, storing its rows in a FakeTableView.
 * A row that fails is repaired and stored like the real view, else it reads as its default but is left in place
 */
export class FakeKeyedSchemaTableView<TRows extends KeyedRowSchemas> {
	readonly table: FakeTableView<unknown>
	readonly schemas: TRows
	readonly repair: KeyedSchemaTableViewOptions<TRows>['repair']

	constructor(table: FakeTableView<unknown>, schemas: TRows, options?: KeyedSchemaTableViewOptions<TRows>) {
		this.table = table
		this.schemas = schemas
		this.repair = options?.repair
	}

	get<K extends keyof TRows & string>(key: K): z.output<TRows[K]> {
		const schema = this.schemas[key]
		const stored = this.table.get(key)
		if (stored === undefined) return schema.parse(undefined)

		let result = schema.safeParse(stored)
		const repair = this.repair?.[key]
		if (!result.success && repair) {
			const repaired = repair(stored, result.error.issues)
			if (repaired) {
				result = schema.safeParse(repaired.row)
				if (result.success) this.table.set(key, result.data)
			}
		}
		return result.success ? result.data : schema.parse(undefined)
	}

	set<K extends keyof TRows & string>(key: K, value: z.output<TRows[K]>): z.output<TRows[K]> {
		const parsed = this.schemas[key].parse(JSON.parse(JSON.stringify(value)))
		this.table.set(key, parsed)
		return structuredClone(parsed)
	}

	delete(key: keyof TRows & string): void {
		this.table.delete(key)
	}
}

/**
 * A stand-in for DataDatabase that hands out FakeTableViews
 */
export class FakeDataDatabase {
	readonly tables = new Map<string, FakeTableView<any>>()

	isFirstRun = true

	getTableView(name: string): FakeTableView<any> {
		let table = this.tables.get(name)
		if (!table) {
			table = new FakeTableView()
			this.tables.set(name, table)
		}
		return table
	}

	/** The rows are stored in the same FakeTableView that {@link getTableView} returns for the table */
	getSchemaTableView<TSchema extends z.ZodType<Record<string, any>>>(
		name: string,
		schema: TSchema,
		options?: SchemaTableViewOptions
	): FakeSchemaTableView<TSchema> {
		return new FakeSchemaTableView(this.getTableView(name), schema, options)
	}

	/** The rows are stored in the same FakeTableView that {@link getTableView} returns for the table */
	getKeyedSchemaTableView<TRows extends KeyedRowSchemas>(
		name: string,
		schemas: TRows,
		options?: KeyedSchemaTableViewOptions<TRows>
	): FakeKeyedSchemaTableView<TRows> {
		return new FakeKeyedSchemaTableView(this.getTableView(name), schemas, options)
	}

	get defaultTableView(): FakeTableView<any> {
		return this.getTableView('main')
	}

	getIsFirstRun(): boolean {
		return this.isFirstRun
	}

	asDataDatabase(): DataDatabase {
		return this as unknown as DataDatabase
	}
}
