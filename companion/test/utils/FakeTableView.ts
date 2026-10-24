import type z from 'zod'
import type { DataDatabase } from '../../lib/Data/Database.js'
import type { DataStoreTableView } from '../../lib/Data/TableView.js'

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
 * Rows are parsed with the schema on read and write like the real view, but invalid rows are only skipped on read.
 */
export class FakeSchemaTableView<TSchema extends z.ZodType<Record<string, any>>> {
	readonly table: FakeTableView<unknown>
	readonly schema: TSchema

	constructor(table: FakeTableView<unknown>, schema: TSchema) {
		this.table = table
		this.schema = schema
	}

	all(): Record<string, z.output<TSchema>> {
		const out: Record<string, z.output<TSchema>> = {}
		for (const [key, value] of Object.entries(this.table.all())) {
			const result = this.schema.safeParse(value)
			if (result.success) out[key] = result.data
		}
		return out
	}

	get(key: string): z.output<TSchema> | undefined {
		const result = this.schema.safeParse(this.table.get(key))
		return result.success ? result.data : undefined
	}

	set(key: string, value: z.input<TSchema>): z.output<TSchema> {
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
		schema: TSchema
	): FakeSchemaTableView<TSchema> {
		return new FakeSchemaTableView(this.getTableView(name), schema)
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
