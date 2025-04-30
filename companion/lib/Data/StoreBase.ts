import path from 'path'
import { Database as SQLiteDB, Statement } from 'better-sqlite3'
import LogController, { Logger } from '../Log/Controller.js'
import { showErrorMessage, showFatalError } from '../Resources/Util.js'
import { DatabaseStartupState, loadSqliteDatabase } from './SqliteLoader.js'
import { assertNever } from '@companion-app/shared/Util.js'

interface ITableRow {
	id: string
	value: string
}

export interface DataStorePaths {
	/**
	 * The full backup file path
	 */
	readonly cfgBakFile: string
	/**
	 * The full corrupt file path
	 */
	readonly cfgCorruptFile: string
	/**
	 * The config directory
	 */
	readonly cfgDir: string
	/**
	 * The full main file path
	 */
	readonly cfgFile: string
	/**
	 * The full main legacy file path
	 */
	readonly cfgLegacyFile: string
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
	 * The paths to the config directory and files
	 */
	protected readonly cfgPaths: DataStorePaths

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
	private isFirstRun = false
	/**
	 * Timestamp of last save to disk
	 */
	private lastsave = Date.now()
	/**
	 * The name to use for the file and logging
	 */
	protected readonly name: string = ''
	/**
	 * Saved queries
	 */
	private tableCache = new Map<string, DataStoreTableView<any>>()
	/**
	 * The SQLite database
	 */
	public store!: SQLiteDB

	/**
	 * The config directory
	 */
	get cfgDir(): string {
		return this.cfgPaths.cfgDir
	}

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

		this.name = name
		this.defaultTable = defaultTable

		if (configDir != ':memory:') {
			this.cfgPaths = {
				cfgDir: configDir,
				cfgFile: path.join(configDir, this.name + '.sqlite'),
				cfgBakFile: path.join(configDir, this.name + '.sqlite.bak'),
				cfgCorruptFile: path.join(configDir, this.name + '.corrupt'),
				cfgLegacyFile: path.join(configDir, this.name),
			}
		} else {
			this.cfgPaths = {
				cfgDir: configDir,
				cfgFile: '',
				cfgBakFile: '',
				cfgCorruptFile: '',
				cfgLegacyFile: '',
			}
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
			?.backup(`${this.cfgPaths.cfgBakFile}`)
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
	 * Attempt to load the database from disk
	 * @access protected
	 */
	protected startSQLite(): void {
		try {
			const loadState = loadSqliteDatabase(this.logger, this.cfgPaths, this.name)

			this.store = loadState.store
			this.tableCache.clear()

			switch (loadState.state) {
				case DatabaseStartupState.RAM:
					this.create()
					this.defaultTableView.get('test')
					this.isFirstRun = true
					this.loadDefaults()

					showErrorMessage(
						'Error starting companion',
						`Could not write to database ${this.name}.  Companion is running in RAM and will not be saved upon exiting.`
					)
					console.error(`Could not create/load database ${this.name}.  Running in RAM`)
					break
				case DatabaseStartupState.Reset:
					this.create()
					this.defaultTableView.get('test')
					this.isFirstRun = true
					this.loadDefaults()

					showErrorMessage('Error starting companion', `Could not load database ${this.name}. Resetting configuration.`)
					console.error(`Could not load database ${this.name}.`)
					break
				case DatabaseStartupState.Normal:
					this.defaultTableView.get('test')
					break
				case DatabaseStartupState.NeedsUpgrade:
					this.migrateFileToSqlite()
					this.defaultTableView.get('test')
					break
				default:
					assertNever(loadState.state)
					break
			}
		} catch (e: any) {
			console.error(`Could not create/load database ${this.name}.  Exiting...`)
			showFatalError('Error starting companion', `Could not create a functional database(${this.name}).  Exiting...`)
		}

		this.setBackupCycle()
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
