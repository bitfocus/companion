import { Database as SQLiteDB } from 'better-sqlite3'
import { Logger } from '../../Log/Controller.js'

export function createTables(store: SQLiteDB | undefined, defaultTable: string, logger: Logger) {
	if (store) {
		try {
			const main = store.prepare(`CREATE TABLE IF NOT EXISTS ${defaultTable} (id STRING UNIQUE, value STRING);`)
			main.run()
			const controls = store.prepare(`CREATE TABLE IF NOT EXISTS controls (id STRING UNIQUE, value STRING);`)
			controls.run()
			const cloud = store.prepare(`CREATE TABLE IF NOT EXISTS cloud (id STRING UNIQUE, value STRING);`)
			cloud.run()
		} catch (e) {
			logger.warn(`Error creating tables`, e)
		}
	}
}
