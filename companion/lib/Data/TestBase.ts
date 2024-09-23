import Database, { Database as SQLiteDB } from 'better-sqlite3'
import LogController, { Logger } from '../Log/Controller.js'

export type DatabaseDefault = Record<string, any>

/**
 * Class for running data tests
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class DataTestBase {
	protected readonly logger: Logger
	/**
	 * The config directory
	 */
	public readonly cfgDir: string
	/**
	 * The default table to dumb keys when one isn't specified
	 */
	protected readonly defaultTable: string
	/**
	 * Flag if this database was created fresh on this run
	 */
	protected isFirstRun = false
	/**
	 * The name to use for the file and logging
	 */
	protected readonly name: string = ''
	/**
	 * The SQLite database
	 */
	public store: SQLiteDB | undefined

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, name, saveInterval, defaults, debug)</code>.
	 * @param configDir - the root config directory
	 * @param name - the name of the flat file
	 * @param defaultTable - the default table for data
	 * @param debug - module path to be used in the debugger
	 */
	constructor(defaults: DatabaseDefault, defaultTable: string, debug: string) {
		this.logger = LogController.createLogger(debug)

		this.cfgDir = "/test/config/empty"
		this.defaultTable = defaultTable

		this.startSQLite()
		this.loadDefaults(defaults)
	}

	/**
	 * Close the file because we're existing
	 */
	public close(): void {
		this.store?.close()
	}

	/**
	 * Delete a key/value pair from the default table
	 * @param key - the key to be delete
	 */
	public deleteKey(key: string): void {
		this.deleteTableKey(this.defaultTable, key)
	}

	/**
	 * Delete a key/value pair from a table
	 * @param table - the table to delete from
	 * @param key - the key to be delete
	 */
	public deleteTableKey(table: string, key: string): void {
		if (table.length > 0 && key.length > 0) {
			const query = this.store?.prepare(`DELETE FROM ${table} WHERE id = @id`)
			this.logger.silly(`Delete key: ${table} - ${key}`)

			try {
				query?.run({ id: key })
			} catch (e: any) {
				this.logger.warn(`Error deleting ${table} - ${key}: ${e.message}`)
			}
		}
	}

	/**
	 * @returns the 'is first run' flag
	 */
	public getIsFirstRun(): boolean {
		return this.isFirstRun
	}

	/**
	 * Get a value from the default table
	 * @param key - the to be retrieved
	 * @param defaultValue  - the default value to use if the key doens't exist
	 * @returns the value
	 */
	public getKey(key: string, defaultValue?: any): any {
		return this.getTableKey(this.defaultTable, key, defaultValue)
	}

	/**
	 * Get all rows from a table
	 * @param table - the table to get from
	 * @returns the rows
	 */
	public getTable(table: string): any {
		let out = {}

		if (table.length > 0 && this.store) {
			const query = this.store?.prepare(`SELECT id, value FROM ${table}`)
			this.logger.silly(`Get table: ${table}`)

			try {
				const rows = query.all()

				if (rows.length > 0) {
					for (const record of Object.values(rows)) {
						try {
							/** @ts-ignore */
							out[record.id] = JSON.parse(record.value)
						} catch (e) {
							/** @ts-ignore */
							out[record.id] = record.value
						}
					}
				}
			} catch (e) {
				this.logger.warn(`Error getting ${table}`, e)
			}
		}

		return out
	}

	/**
	 * Get a value from a table
	 * @param table - the table to get from
	 * @param key - the key to be retrieved
	 * @param defaultValue - the default value to use if the key doesn't exist
	 * @returns the value
	 */
	public getTableKey(table: string, key: string, defaultValue?: any): any {
		let out

		if (table.length > 0 && key.length > 0) {
			const query = this.store?.prepare(`SELECT value FROM ${table} WHERE id = @id`)
			this.logger.silly(`Get table key: ${table} - ${key}`)

			try {
				const row = query?.get({ id: key })
				/** @ts-ignore */
				if (row && row.value) {
					try {
						/** @ts-ignore */
						out = JSON.parse(row.value)
					} catch (e) {
						/** @ts-ignore */
						out = row.value
					}
				} else {
					this.logger.silly(`Get table key: ${table} - ${key} failover`)
					this.setTableKey(table, key, defaultValue)
					out = defaultValue
				}
			} catch (e: any) {
				this.logger.warn(`Error getting ${table} - ${key}: ${e.message}`)
			}
		}
		return out
	}

	/**
	 * Checks if the main table has a value
	 * @param key - the key to be checked
	 */
	public hasKey(key: string): boolean {
		let row

		const query = this.store?.prepare(`SELECT id FROM ${this.defaultTable} WHERE id = @id`)
		row = query?.get({ id: key })

		return !!row
	}

	/**
	 * Save the defaults since a file could not be found/loaded/parsed
	 */
	protected loadDefaults(defaults: DatabaseDefault): void {
		for (const [key, value] of Object.entries(defaults)) {
			for (const [key2, value2] of Object.entries(value)) {
				this.setTableKey(key, key2, value2)
			}
		}

		this.isFirstRun = true
	}

	/**
	 * Save/update a key/value pair to the default table
	 * @param key - the key to save under
	 * @param value - the object to save
	 */
	public setKey(key: string, value: any): void {
		this.setTableKey(this.defaultTable, key, value)
	}

	/**
	 * Save/update a key/value pair to a table
	 * @param table - the table to save in
	 * @param key - the key to save under
	 * @param value - the object to save
	 */
	public setTableKey(table: string, key: string, value: any): void {
		if (table.length > 0 && key.length > 0 && value) {
			if (typeof value === 'object') {
				value = JSON.stringify(value)
			}

			const query = this.store?.prepare(
				`INSERT INTO ${table} (id, value) VALUES (@id, @value) ON CONFLICT(id) DO UPDATE SET value = @value`
			)
			this.logger.silly(`Set table key ${table} - ${key} - ${value}`)

			try {
				query?.run({ id: key, value: value })
			} catch (e: any) {
				this.logger.warn(`Error updating ${table} - ${key}: ${e.message}`)
			}
		}
	}

	/**
	 * Attempt to load the database from disk
	 * @access protected
	 */
	private startSQLite(): void {
		this.store = new Database(':memory:')
	}
}
