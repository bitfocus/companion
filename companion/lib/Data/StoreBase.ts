import fs from 'fs-extra'
import path from 'path'
import { Database as SQLiteDB, Statement } from 'better-sqlite3'
import LogController, { Logger } from '../Log/Controller.js'
import { showErrorMessage, showFatalError } from '../Resources/Util.js'
import { createSqliteDatabase } from './Util.js'

enum DatabaseStartupState {
	Normal = 0,
	Reset = 1,
	RAM = 2,
	Fatal = 3,
}

interface ITableRow {
	id: string
	value: string
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
 */
export abstract class DataStoreBase<TDefaultTableContent extends Record<string, any>> {
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
	private tableCache = new Map<string, DataStoreTableView<any>>()
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
	 * @returns the 'is first run' flag
	 */
	public getIsFirstRun(): boolean {
		return this.isFirstRun
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
				// perform a flush of the WAL file. It may be a little aggressive for this to be a TRUNCATE vs FULL, but it ensures the WAL doesn't grow infinitly
				this.store.pragma('wal_checkpoint(TRUNCATE)')

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
			this.store = createSqliteDatabase(this.cfgDir)
			this.tableCache.clear()
			this.create()
			this.defaultTableView.get('test')
			this.loadDefaults()
		} else {
			if (fs.existsSync(this.cfgFile)) {
				this.logger.silly(`${this.cfgFile} exists. trying to read`)

				try {
					this.store = this.#createDatabase(this.cfgFile)
					this.tableCache.clear()
					this.defaultTableView.get('test')
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
					this.store = this.#createDatabase(this.cfgFile)
					this.tableCache.clear()
					this.logger.info(`Legacy ${this.cfgLegacyFile} exists.  Attempting migration to SQLite.`)
					this.migrateFileToSqlite()
					this.defaultTableView.get('test')
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
				this.store = createSqliteDatabase(':memory:')
				this.tableCache.clear()
				this.setStartupState(DatabaseStartupState.RAM)
				this.create()
				this.defaultTableView.get('test')
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

	#createDatabase(filename: string) {
		const db = createSqliteDatabase(filename)

		try {
			db.pragma('journal_mode = WAL')
		} catch (err) {
			this.logger.warn(`Error setting journal mode: ${err}`)
		}

		return db
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
				this.store = this.#createDatabase(this.cfgFile)
				this.tableCache.clear()
				this.defaultTableView.get('test')
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
				this.store = this.#createDatabase(this.cfgFile)
				this.tableCache.clear()
				this.create()
				this.defaultTableView.get('test')
				this.loadDefaults()
			} catch (e: any) {
				this.logger.error(e.message)
			}
		}
	}

	get defaultTableView(): DataStoreTableView<TDefaultTableContent> {
		return this.getTableView(this.defaultTable)
	}

	public getTableView<TableContent extends Record<string, any>>(tableName: string): DataStoreTableView<TableContent> {
		if (!tableName || typeof tableName !== 'string') throw new Error('Invalid table name')

		const cachedTable = this.tableCache.get(tableName)
		if (cachedTable) return cachedTable

		const newTable = new DataStoreTableView<TableContent>(this.logger, this.store, tableName, () => this.setDirty())
		this.tableCache.set(tableName, newTable)

		return newTable
	}
}

type ValueIfJsonEncodable<T> = T extends number | { [key: string]: any } ? T : never
type ValueIfString<T> = T extends string ? T : never

export class DataStoreTableView<TableContent extends Record<string, any>> {
	readonly #logger: Logger

	readonly #store: SQLiteDB
	readonly tableName: string
	readonly #triggerDirty: () => void

	readonly #deleteByIdQuery: Statement<[{ id: string }], ITableRow>
	readonly #emptyTableQuery: Statement<[], ITableRow>
	readonly #getAllQuery: Statement<[], ITableRow>
	readonly #getByIdQuery: Statement<[{ id: string }], ITableRow>
	readonly #setByIdQuery: Statement<[{ id: string; value: string }], ITableRow>

	constructor(logger: Logger, store: SQLiteDB, tableName: string, triggerDirty: () => void) {
		this.#logger = logger.child({ source: tableName })
		this.#store = store
		this.tableName = tableName
		this.#triggerDirty = triggerDirty

		// Ensure the table exists
		this.#store.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (id STRING UNIQUE, value STRING);`).run()

		this.#deleteByIdQuery = this.#store.prepare(`DELETE FROM ${tableName} WHERE id = @id`)
		this.#emptyTableQuery = this.#store.prepare(`DELETE FROM ${tableName}`)
		this.#getAllQuery = this.#store.prepare(`SELECT id, value FROM ${tableName}`)
		this.#getByIdQuery = this.#store.prepare(`SELECT value FROM ${tableName} WHERE id = @id`)
		this.#setByIdQuery = this.#store.prepare(
			`INSERT INTO ${tableName} (id, value) VALUES (@id, @value) ON CONFLICT(id) DO UPDATE SET value = @value`
		)
	}

	private validateKey(key: string | number | Symbol): asserts key is string {
		if (!key || typeof key !== 'string') throw new Error('Invalid key')
	}

	/**
	 * Get all rows from the table
	 */
	all(): TableContent {
		// TODO - how to make this safe for json vs string?

		let out: TableContent = {} as any

		this.#logger.silly(`Get table`)

		try {
			const rows = this.#getAllQuery.all()
			for (const record of rows) {
				try {
					/** @ts-ignore */
					out[record.id] = JSON.parse(record.value)
				} catch (e) {
					/** @ts-ignore */
					out[record.id] = record.value
				}
			}
		} catch (e: any) {
			this.#logger.warn(`Error getting: ${e.message}`)
		}

		return out
	}

	private getTableKeyRaw(key: string): string | undefined {
		this.#logger.silly(`Get table key: ${key}`)

		try {
			const row = this.#getByIdQuery.get({ id: key })
			return row?.value
		} catch (e: any) {
			this.#logger.warn(`Error getting ${key}: ${e.message}`)
			return undefined
		}
	}

	/**
	 * Save/update a key/value pair to a table
	 * @param key - the key to save under
	 * @param value - the object to save
	 */
	private setTableKeyRaw(key: string, value: string): void {
		this.#logger.silly(`Set table key ${key} - ${value}`)

		try {
			this.#setByIdQuery.run({ id: key, value: value })
		} catch (e: any) {
			this.#logger.warn(`Error updating ${key}: ${e.message}`)
		}

		this.#triggerDirty()
	}

	/**
	 * Get a value from the table
	 * @param id - the key to be retrieved
	 */
	get<T extends keyof TableContent>(id: T): ValueIfJsonEncodable<TableContent[T]> | undefined {
		this.validateKey(id)

		const value = this.getTableKeyRaw(id)
		if (!value) return undefined

		try {
			return JSON.parse(value)
		} catch (e: any) {
			this.#logger.warn(`Error parsing ${id}: ${e.message}`)
			return undefined
		}
	}

	/**
	 * Get a value from the table or set a default value
	 * @param id - the key to be retrieved
	 * @param defaultValue - the default value to store if the key doesn't exist
	 */
	getOrDefault<T extends keyof TableContent>(
		id: T,
		defaultValue: ValueIfJsonEncodable<TableContent[T]>
	): ValueIfJsonEncodable<TableContent[T]> {
		this.validateKey(id)

		const value = this.getTableKeyRaw(id)
		if (value === undefined) {
			this.setTableKeyRaw(id, JSON.stringify(defaultValue))
			return defaultValue
		}

		try {
			return JSON.parse(value)
		} catch (e: any) {
			this.#logger.warn(`Error parsing ${String(id)}: ${e.message}`)
			return defaultValue
		}
	}

	/**
	 * Get a value from the table or set a default value
	 * @param id - the key to be retrieved
	 * @param defaultValue - the default value to store if the key doesn't exist
	 */
	getPrimitiveOrDefault<T extends keyof TableContent>(
		id: T,
		defaultValue: ValueIfString<TableContent[T]>
	): ValueIfString<TableContent[T]> {
		this.validateKey(id)

		const value = this.getTableKeyRaw(id)
		if (value === undefined) {
			this.setTableKeyRaw(id, defaultValue)
			return defaultValue
		}
		return value as any // The types match, but TS doesn't know that
	}

	/**
	 * Set a value in the table
	 * @param id - the key to be set
	 * @param value - the value to be set
	 */
	set<T extends keyof TableContent>(id: T, value: ValueIfJsonEncodable<TableContent[T]>): void {
		this.validateKey(id)

		this.setTableKeyRaw(id, JSON.stringify(value))
	}

	/**
	 * Set a value in the table
	 * @param id - the key to be set
	 * @param value - the value to be set
	 */
	setPrimitive<T extends keyof TableContent>(id: T, value: ValueIfString<TableContent[T]>): void {
		this.validateKey(id)

		this.setTableKeyRaw(id, value)
	}

	/**
	 * Delete a value from the table
	 * @param id - the key to be deleted
	 */
	delete(id: keyof TableContent): void {
		this.validateKey(id)

		this.#logger.silly(`Delete key: ${id}`)

		try {
			this.#deleteByIdQuery.run({ id })
		} catch (e: any) {
			this.#logger.warn(`Error deleting ${id}: ${e.message}`)
		}

		this.#triggerDirty()
	}

	/**
	 * Clear all values from the table
	 */
	clear(): void {
		this.#logger.silly(`Empty table`)

		try {
			this.#emptyTableQuery.run()
		} catch (e: any) {
			this.#logger.warn(`Error emptying: ${e.message}`)
		}

		this.#triggerDirty()
	}
}
