import type { DatabaseSync } from 'node:sqlite'
import type { Logger } from '../../Log/Controller.js'

export function createTables(store: DatabaseSync | undefined, defaultTable: string, logger: Logger): void {
	if (store) {
		try {
			const create = store.prepare(`CREATE TABLE IF NOT EXISTS ${defaultTable} (id STRING UNIQUE, value STRING);`)
			create.run()
		} catch (_e) {
			logger.warn(`Error creating table ${defaultTable}`)
		}
	}
}
