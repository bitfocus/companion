import type { DatabaseSync } from 'node:sqlite'

/**
 * Store a row exactly as given, without the JSON encoding of a table view, like old or hand-edited data
 */
export function setRawRow(store: DatabaseSync, table: string, id: string, value: string): void {
	store.prepare(`CREATE TABLE IF NOT EXISTS ${table} (id STRING UNIQUE, value STRING);`).run()
	store
		.prepare(`INSERT INTO ${table} (id, value) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET value = excluded.value`)
		.run(id, value)
}
