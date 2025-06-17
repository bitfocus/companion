import { Database as SQLiteDB } from 'better-sqlite3'
import { Logger } from '../../Log/Controller.js'

export function createTables(store: SQLiteDB | undefined, defaultTable: string, logger: Logger) {
	if (store) {
		try {
			store.prepare(`CREATE TABLE IF NOT EXISTS ${defaultTable} (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS controls (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS cloud (id STRING UNIQUE, value STRING);`).run()

			store.prepare(`CREATE TABLE IF NOT EXISTS custom_variables (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS connections (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS pages (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS surfaces (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS surface_groups (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS surfaces_remote (id STRING UNIQUE, value STRING);`).run()
			store.prepare(`CREATE TABLE IF NOT EXISTS image_library (id STRING UNIQUE, value STRING);`).run()
		} catch (e) {
			logger.warn(`Error creating tables`, e)
		}
	}
}
