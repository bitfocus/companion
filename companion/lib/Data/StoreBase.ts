import fs from 'fs-extra'
import path from 'path'
import Database, { Database as SQLiteDB, Statement } from 'better-sqlite3'
import LogController, { Logger } from '../Log/Controller.js'
import { showErrorMessage, showFatalError } from '../Resources/Util.js'

export type DatabaseDefault = Record<string, any>

enum DatabaseStartupState {
	Normal = 0,
	Reset = 1,
	RAM = 2,
	Fatal = 3,
}

/**
 * Abstract class to be extended by the DB classes.
 * See {@link DataCache} and {@link DataDatabase}
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
export abstract class DataStoreBase {
	protected readonly logger: Logger
	/**
	 * The time to use for the save interval
	 */
	private backupCycle: NodeJS.Timeout | undefined
	/**
	 * The interval to fire a backup to disk when dirty
	 */
	private readonly backupInterval: number = 60000
	/**
	 * The full backup file path
	 */
	private readonly cfgBakFile: string = ''
	/**
	 * The full corrupt file path
	 */
	private readonly cfgCorruptFile: string = ''
	/**
	 * The config directory
	 */
	public readonly cfgDir: string
	/**
	 * The full main file path
	 */
	private readonly cfgFile: string = ''
	/**
	 * The full main legacy file path
	 */
	private readonly cfgLegacyFile: string = ''
	/**
	 * The default table to dump keys when one isn't specified
	 */
	protected readonly defaultTable: string
	/**
	 * Flag to tell the <code>backupInternal</code> there's
	 * changes to backup to disk
	 */
	private dirty = false
	/**
	 * Flag if this database was created fresh on this run
	 */
	protected isFirstRun = false
	/**
	 * Timestamp of last save to disk
	 */
	private lastsave = Date.now()
	/**
	 * The name to use for the file and logging
	 */
	protected readonly name: string = ''
	/**
	 * The startup state of the database
	 */
	protected startupState: DatabaseStartupState = DatabaseStartupState.Normal
	/**
	 * Saved queries
	 */
	private statementCache: Record<string, Statement> = {}
	/**
	 * The SQLite database
	 */
	public store!: SQLiteDB

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, name, saveInterval, defaults, debug)</code>.
	 * @param configDir - the root config directory
	 * @param name - the name of the flat file
	 * @param defaultTable - the default table for data
	 * @param debug - module path to be used in the debugger
	 */
	constructor(configDir: string, name: string, defaultTable: string, debug: string) {
		this.logger = LogController.createLogger(debug)

		this.cfgDir = configDir
		this.name = name
		this.defaultTable = defaultTable

		if (configDir != ':memory:') {
			this.cfgFile = path.join(this.cfgDir, this.name + '.sqlite')
			this.cfgBakFile = path.join(this.cfgDir, this.name + '.sqlite.bak')
			this.cfgCorruptFile = path.join(this.cfgDir, this.name + '.corrupt')
			this.cfgLegacyFile = path.join(this.cfgDir, this.name)
		}
	}

	/**
	 * Create the database tables
	 */
	protected abstract create(): void

	/**
	 * Close the file because we're existing
	 */
	public close(): void {
		this.store.close()
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
			let query: Statement
			const cacheKey = `delete-${table}`

			if (this.statementCache[cacheKey]) {
				query = this.statementCache[cacheKey]
			} else {
				query = this.store.prepare(`DELETE FROM ${table} WHERE id = @id`)
				this.statementCache[cacheKey]
			}

			this.logger.silly(`Delete key: ${table} - ${key}`)

			try {
				query.run({ id: key })
			} catch (e: any) {
				this.logger.warn(`Error deleting ${table} - ${key}: ${e.message}`)
			}

			this.setDirty()
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
	public getTable(table: string): Record<string, any> {
		let out: Record<string, any> = {}

		if (table.length > 0) {
			const query = this.store.prepare(`SELECT id, value FROM ${table}`)
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
			} catch (e: any) {
				this.logger.warn(`Error getting ${table}: ${e.message}`)
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
			let query: Statement
			const cacheKey = `get-${table}`

			if (this.statementCache[cacheKey]) {
				query = this.statementCache[cacheKey]
			} else {
				query = this.store.prepare(`SELECT value FROM ${table} WHERE id = @id`)
				this.statementCache[cacheKey]
			}

			this.logger.silly(`Get table key: ${table} - ${key}`)

			try {
				const row = query.get({ id: key })
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

		const query = this.store.prepare(`SELECT id FROM ${this.defaultTable} WHERE id = @id`)
		row = query.get({ id: key })

		return !!row
	}

	/**
	 * Import raw data into a table
	 * @param table - the table to import to
	 * @param data - the data
	 */
	public importTable(table: string, data: any) {
		if (typeof data === 'object') {
			for (const [key, value] of Object.entries(data)) {
				this.setTableKey(table, key, value)
			}
		}
	}

	/**
	 * Save the defaults since a file could not be found/loaded/parsed
	 */
	protected abstract loadDefaults(): void

	/**
	 * Load the old file driver and migrate to SQLite
	 */
	protected abstract migrateFileToSqlite(): void

	/**
	 * Save a backup of the db
	 */
	private saveBackup(): void {
		this.store
			?.backup(`${this.cfgBakFile}`)
			.then(() => {
				this.lastsave = Date.now()
				this.dirty = false
				this.logger.debug('backup complete')
			})
			.catch((err) => {
				this.logger.warn(`backup failed: ${err.message}`)
			})
	}

	/**
	 * Setup the save cycle interval
	 */
	private setBackupCycle(): void {
		if (this.backupCycle) return

		this.backupCycle = setInterval(() => {
			// See if the database is dirty and needs to be backed up
			if (Date.now() - this.lastsave > this.backupInterval && this.dirty) {
				this.saveBackup()
			}
		}, this.backupInterval)
	}

	/**
	 * Register that there are changes in the database that need to be saved as soon as possible
	 */
	protected setDirty(): void {
		this.dirty = true
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

			let query: Statement
			const cacheKey = `set-${table}`

			if (this.statementCache[cacheKey]) {
				query = this.statementCache[cacheKey]
			} else {
				query = this.store.prepare(
					`INSERT INTO ${table} (id, value) VALUES (@id, @value) ON CONFLICT(id) DO UPDATE SET value = @value`
				)
				this.statementCache[cacheKey]
			}

			this.logger.silly(`Set table key ${table} - ${key} - ${value}`)

			try {
				query.run({ id: key, value: value })
			} catch (e: any) {
				this.logger.warn(`Error updating ${table} - ${key}: ${e.message}`)
			}

			this.setDirty()
		}
	}

	/**
	 * Update the startup state to a new state if that new state is higher
	 * @param newState - the new state
	 */
	protected setStartupState(newState: DatabaseStartupState): void {
		this.startupState = this.startupState > newState ? this.startupState : newState
	}

	/**
	 * Attempt to load the database from disk
	 * @access protected
	 */
	protected startSQLite(): void {
		if (this.cfgDir == ':memory:') {
			this.store = new Database(this.cfgDir)
			this.create()
			this.getKey('test')
			this.loadDefaults()
		} else {
			if (fs.existsSync(this.cfgFile)) {
				this.logger.silly(`${this.cfgFile} exists. trying to read`)

				try {
					this.store = new Database(this.cfgFile)
					this.getKey('test')
				} catch (e) {
					try {
						try {
							if (fs.existsSync(this.cfgCorruptFile)) {
								fs.rmSync(this.cfgCorruptFile)
							}

							fs.moveSync(this.cfgFile, this.cfgCorruptFile)
							this.logger.error(`${this.name} could not be parsed.  A copy has been saved to ${this.cfgCorruptFile}.`)
						} catch (e: any) {
							this.logger.error(`${this.name} could not be parsed.  A copy could not be saved.`)
						}
					} catch (err) {
						this.logger.silly(`${this.name} load Error making or deleting corrupted backup: ${err}`)
					}

					this.startSQLiteWithBackup()
				}
			} else if (fs.existsSync(this.cfgBakFile)) {
				this.logger.warn(`${this.name} is missing.  Attempting to recover the configuration.`)
				this.startSQLiteWithBackup()
			} else if (fs.existsSync(this.cfgLegacyFile)) {
				try {
					this.store = new Database(this.cfgFile)
					this.logger.info(`Legacy ${this.cfgLegacyFile} exists.  Attempting migration to SQLite.`)
					this.migrateFileToSqlite()
					this.getKey('test')
				} catch (e: any) {
					this.setStartupState(DatabaseStartupState.Reset)
					this.logger.error(e.message)
					this.startSQLiteWithDefaults()
				}
			} else {
				this.logger.silly(this.cfgFile, `doesn't exist. loading defaults`)
				this.startSQLiteWithDefaults()
			}
		}

		if (!this.store) {
			try {
				this.store = new Database(':memory:')
				this.setStartupState(DatabaseStartupState.RAM)
				this.create()
				this.getKey('test')
				this.loadDefaults()
			} catch (e: any) {
				this.setStartupState(DatabaseStartupState.Fatal)
			}
		}

		switch (this.startupState) {
			case DatabaseStartupState.Fatal:
				showFatalError('Error starting companion', `Could not create a functional database(${this.name}).  Exiting...`)
				console.error(`Could not create/load database ${this.name}.  Exiting...`)
				break
			case DatabaseStartupState.RAM:
				showErrorMessage(
					'Error starting companion',
					`Could not write to database ${this.name}.  Companion is running in RAM and will not be saved upon exiting.`
				)
				console.error(`Could not create/load database ${this.name}.  Running in RAM`)
				break
			case DatabaseStartupState.Reset:
				showErrorMessage('Error starting companion', `Could not load database ${this.name}. Resetting configuration.`)
				console.error(`Could not load database ${this.name}.`)
				break
		}

		this.setBackupCycle()
	}

	/**
	 * Attempt to load the backup file from disk as a recovery
	 */
	private startSQLiteWithBackup(): void {
		if (fs.existsSync(this.cfgBakFile)) {
			this.logger.silly(`${this.cfgBakFile} exists. trying to read`)
			try {
				try {
					fs.rmSync(this.cfgFile)
				} catch (e) {}

				fs.copyFileSync(this.cfgBakFile, this.cfgFile)
				this.store = new Database(this.cfgFile)
				this.getKey('test')
			} catch (e: any) {
				this.setStartupState(DatabaseStartupState.Reset)
				this.logger.error(e.message)
				this.startSQLiteWithDefaults()
			}
		} else {
			this.setStartupState(DatabaseStartupState.Reset)
			this.startSQLiteWithDefaults()
		}
	}

	/**
	 * Attempt to start a fresh DB and load the defaults
	 */
	private startSQLiteWithDefaults(): void {
		try {
			if (fs.existsSync(this.cfgFile)) {
				fs.rmSync(this.cfgFile)
			}
		} catch (e: any) {
		} finally {
			try {
				this.store = new Database(this.cfgFile)
				this.create()
				this.getKey('test')
				this.loadDefaults()
			} catch (e: any) {
				this.logger.error(e.message)
			}
		}
	}
}
