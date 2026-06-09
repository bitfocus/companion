import type { DataDatabase } from '../../lib/Data/Database.js'
import type { DataStoreTableView } from '../../lib/Data/StoreBase.js'

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
 * A stand-in for DataDatabase that hands out FakeTableViews
 */
export class FakeDataDatabase {
	readonly tables = new Map<string, FakeTableView<any>>()

	getTableView(name: string): FakeTableView<any> {
		let table = this.tables.get(name)
		if (!table) {
			table = new FakeTableView()
			this.tables.set(name, table)
		}
		return table
	}

	asDataDatabase(): DataDatabase {
		return this as unknown as DataDatabase
	}
}
