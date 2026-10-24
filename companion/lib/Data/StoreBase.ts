import path from 'node:path'
import { DatabaseSync, backup as SqliteBackup } from 'node:sqlite'
import fs from 'fs-extra'
import type z from 'zod'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import LogController, { type Logger } from '../Log/Controller.js'
import { showErrorMessage, showFatalError } from '../Resources/Util.js'
import { BROKEN_ROWS_TABLE, DataStoreSchemaTableView } from './SchemaTableView.js'
import { DataStoreTableView } from './TableView.js'
import {
	DATABASE_OPERATIONS,
	type DatabaseOperation,
	type DataStoreTableViewBase,
	type DataStoreTableViewHooks,
	type TableOperationStats,
} from './TableViewBase.js'

enum DatabaseStartupState {
	Normal = 0,
	Reset = 1,
	RAM = 2,
	Fatal = 3,
}

/** Sink called with the timing of each completed SQLite operation. */
export type OperationObserver = (table: string, operation: DatabaseOperation, seconds: number) => void

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
	 * The interval to slowly write a backup to disk to minimise risk of corruption
	 */
	private readonly backupInterval: number = 10 * 60 * 1000
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
	private schemaTableCache = new Map<string, DataStoreSchemaTableView<any>>()
	/**
	 * Sink for per-operation timings. Required and injected at construction, so it is immutable for the
	 * store's lifetime and cannot be forgotten when a new store type is added.
	 */
	private readonly operationObserver: OperationObserver
	/**
	 * The SQLite database
	 */
	public store!: DatabaseSync

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, name, saveInterval, defaults, debug)</code>.
	 * @param configDir - the root config directory
	 * @param name - the name of the flat file
	 * @param defaultTable - the default table for data
	 * @param debug - module path to be used in the debugger
	 * @param operationObserver - sink for per-operation timings
	 */
	constructor(
		configDir: string,
		name: string,
		defaultTable: string,
		debug: string,
		operationObserver: OperationObserver
	) {
		this.logger = LogController.createLogger(debug)

		this.cfgDir = configDir
		this.name = name
		this.defaultTable = defaultTable
		this.operationObserver = operationObserver

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
		if (this.backupCycle) {
			clearInterval(this.backupCycle)
			this.backupCycle = undefined
		}

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
		const timeBefore = performance.now()
		SqliteBackup(this.store, `${this.cfgBakFile}`)
			.then(() => {
				// perform a flush of the WAL file. It may be a little aggressive for this to be a TRUNCATE vs FULL, but it ensures the WAL doesn't grow infinitely
				this.store.exec('PRAGMA wal_checkpoint(TRUNCATE)')

				const saveDuration = performance.now() - timeBefore

				this.lastsave = Date.now()
				this.dirty = false
				this.logger.info(`backup complete in ${saveDuration}ms`)
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
			this.store = new DatabaseSync(this.cfgDir)
			this.#clearTableViews()
			this.create()
			this.defaultTableView.get('test')
			this.loadDefaults()
		} else {
			if (fs.existsSync(this.cfgFile)) {
				this.logger.silly(`${this.cfgFile} exists. trying to read`)

				try {
					this.store = this.#createDatabase(this.cfgFile)
					this.#clearTableViews()
					this.defaultTableView.get('test')
				} catch (_e) {
					// Release our handle on the unreadable file before touching it on disk. Windows keeps a
					// lock on open files, so leaving it open would block the rename below (and leak the handle).
					this.#closeStoreQuietly()

					try {
						try {
							if (fs.existsSync(this.cfgCorruptFile)) {
								fs.rmSync(this.cfgCorruptFile)
							}

							fs.moveSync(this.cfgFile, this.cfgCorruptFile)
							this.logger.error(`${this.name} could not be parsed.  A copy has been saved to ${this.cfgCorruptFile}.`)
						} catch (_e) {
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
					this.#clearTableViews()
					this.logger.info(`Legacy ${this.cfgLegacyFile} exists.  Attempting migration to SQLite.`)
					this.migrateFileToSqlite()
					this.defaultTableView.get('test')
				} catch (e) {
					// Release the handle opened above before resetting (see the corrupt-file path)
					this.#closeStoreQuietly()

					this.setStartupState(DatabaseStartupState.Reset)
					this.logger.error(stringifyError(e))
					this.startSQLiteWithDefaults()
				}
			} else {
				this.logger.silly(this.cfgFile, `doesn't exist. loading defaults`)
				this.startSQLiteWithDefaults()
			}
		}

		if (!this.store) {
			try {
				this.store = new DatabaseSync(':memory:')
				this.#clearTableViews()
				this.setStartupState(DatabaseStartupState.RAM)
				this.create()
				this.defaultTableView.get('test')
				this.loadDefaults()
			} catch (_e) {
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

	/** Close the current database handle if one is open, swallowing any error. Used on the recovery
	 * paths before a file is renamed/deleted or the store is reopened, so a stale handle isn't leaked
	 * (and doesn't keep a Windows file lock that would block the rename). */
	#closeStoreQuietly(): void {
		try {
			this.store?.close()
		} catch (_e) {
			// Already closed or never opened; nothing to do
		}
	}

	#createDatabase(filename: string) {
		const db = new DatabaseSync(filename)

		try {
			db.exec('PRAGMA journal_mode = WAL')
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
				} catch (_e) {
					// Ignore, we are about to replace the file anyway
				}

				fs.copyFileSync(this.cfgBakFile, this.cfgFile)
				this.store = this.#createDatabase(this.cfgFile)
				this.#clearTableViews()
				this.defaultTableView.get('test')
			} catch (e) {
				this.setStartupState(DatabaseStartupState.Reset)
				this.logger.error(stringifyError(e))
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
		} catch (_e) {
			// Ignore, we are about to replace the file anyway
		} finally {
			try {
				this.store = this.#createDatabase(this.cfgFile)
				this.#clearTableViews()
				this.create()
				this.defaultTableView.get('test')
				this.loadDefaults()
			} catch (e) {
				this.logger.error(stringifyError(e))
			}
		}
	}

	get defaultTableView(): DataStoreTableView<TDefaultTableContent> {
		return this.getTableView(this.defaultTable)
	}

	/** Drop the cached table views, as they are bound to the previous SQLite handle */
	#clearTableViews(): void {
		this.tableCache.clear()
		this.schemaTableCache.clear()
	}

	#createTableViewHooks(tableName: string): DataStoreTableViewHooks {
		return {
			onDirty: () => this.setDirty(),
			// The view knows the table; the store adds the database name when forwarding to the observer.
			onOperation: (operation, seconds) => this.operationObserver(tableName, operation, seconds),
		}
	}

	public getTableView<TableContent extends Record<string, any>>(tableName: string): DataStoreTableView<TableContent> {
		if (!tableName || typeof tableName !== 'string') throw new Error('Invalid table name')

		const cachedTable = this.tableCache.get(tableName)
		if (cachedTable) return cachedTable

		const newTable = new DataStoreTableView<TableContent>(
			this.logger,
			this.store,
			tableName,
			this.#createTableViewHooks(tableName)
		)
		this.tableCache.set(tableName, newTable)

		return newTable
	}

	/**
	 * Get a view of a table whose rows are parsed with a schema when read and written.
	 * Rows that fail to parse when read are moved to the broken rows table.
	 * @param tableName - the table to view
	 * @param schema - the schema for each row
	 */
	public getSchemaTableView<TSchema extends z.ZodType<Record<string, any>>>(
		tableName: string,
		schema: TSchema
	): DataStoreSchemaTableView<TSchema> {
		if (!tableName || typeof tableName !== 'string') throw new Error('Invalid table name')
		if (tableName === BROKEN_ROWS_TABLE) throw new Error('Cannot view the broken rows table with a schema')

		const cachedTable = this.schemaTableCache.get(tableName)
		if (cachedTable) {
			if (cachedTable.schema !== schema) throw new Error(`Table "${tableName}" already has a different schema`)
			return cachedTable
		}

		const newTable = new DataStoreSchemaTableView(
			this.logger,
			this.store,
			tableName,
			this.#createTableViewHooks(tableName),
			this.getTableView(BROKEN_ROWS_TABLE),
			schema
		)
		this.schemaTableCache.set(tableName, newTable)

		return newTable
	}

	/**
	 * Operation/error counts, for metrics. Only covers tables that have a cached view (i.e. seen traffic).
	 * A table with both a plain and a schema view reports their combined counts.
	 */
	public getTableOperationStats(): TableOperationStats[] {
		const merged = new Map<string, TableOperationStats>()

		const views: DataStoreTableViewBase[] = [...this.tableCache.values(), ...this.schemaTableCache.values()]
		for (const view of views) {
			const stats = view.collectOperationStats()
			const existing = merged.get(stats.table)
			if (!existing) {
				merged.set(stats.table, stats)
				continue
			}

			for (const operation of DATABASE_OPERATIONS) {
				existing.counts[operation] += stats.counts[operation]
				existing.errors[operation] += stats.errors[operation]
			}
		}

		return Array.from(merged.values())
	}

	/** Row count of every table, enumerated from `sqlite_master` so untouched tables are included too. */
	public getTableRowCounts(): { table: string; rows: number }[] {
		try {
			const tables = this.store
				.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
				.all() as { name: string }[]

			const out: { table: string; rows: number }[] = []
			for (const { name } of tables) {
				try {
					const row = this.store.prepare(`SELECT COUNT(*) AS count FROM "${name}"`).get() as { count: number }
					out.push({ table: name, rows: row.count })
				} catch (e) {
					this.logger.warn(`Error counting rows in ${name}: ${stringifyError(e)}`)
				}
			}
			return out
		} catch (e) {
			this.logger.warn(`Error reading table list: ${stringifyError(e)}`)
			return []
		}
	}

	/**
	 * Current on-disk size of the database, from SQLite's own page accounting (`page_count * page_size`).
	 * `totalBytes` is the size of the main database file (including reusable free pages); `freeBytes` is the
	 * portion sitting on the freelist. Excludes the transient WAL file. Cheap enough to read at scrape time;
	 * returns zeros if the pragmas fail.
	 */
	public getDiskSizeInfo(): { totalBytes: number; freeBytes: number } {
		try {
			const pageSize = (this.store.prepare('PRAGMA page_size').get() as { page_size: number }).page_size
			const pageCount = (this.store.prepare('PRAGMA page_count').get() as { page_count: number }).page_count
			const freeCount = (this.store.prepare('PRAGMA freelist_count').get() as { freelist_count: number }).freelist_count
			return { totalBytes: pageSize * pageCount, freeBytes: pageSize * freeCount }
		} catch (e) {
			this.logger.warn(`Error reading database size: ${stringifyError(e)}`)
			return { totalBytes: 0, freeBytes: 0 }
		}
	}

	/**
	 * Check if a table exists in the database
	 * @param tableName - the name of the table to check
	 * @returns true if the table exists, false otherwise
	 */
	public tableExists(tableName: string): boolean {
		if (!tableName || typeof tableName !== 'string') throw new Error('Invalid table name')

		try {
			const result = this.store
				.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
				.get(tableName) as { name: string } | undefined

			return !!result
		} catch (e) {
			this.logger.warn(`Error checking if table ${tableName} exists: ${stringifyError(e)}`)
			return false
		}
	}

	/**
	 * Rename a table in the database with proper edge case handling.
	 *
	 * **IMPORTANT**: This method should only be called during database upgrades (before any controllers
	 * are initialized). DataStoreTableView objects contain prepared SQL statements with baked-in table names.
	 * If any code has cached references to DataStoreTableView objects for the old table name, those
	 * references will break after the rename. During startup upgrades this is safe because the cache is
	 * empty and no external code has obtained table views yet.
	 *
	 * Edge cases handled:
	 * - If both tables exist and have rows, their contents are merged (old table takes precedence on conflicts)
	 * - If the new table does not exist or is empty, it is replaced by the old table
	 * - If the old table doesn't exist, the operation is skipped
	 *
	 * @param oldTableName - the current name of the table
	 * @param newTableName - the new name for the table
	 */
	public renameTable(oldTableName: string, newTableName: string): void {
		if (!oldTableName || typeof oldTableName !== 'string') throw new Error('Invalid old table name')
		if (!newTableName || typeof newTableName !== 'string') throw new Error('Invalid new table name')

		// Clear the old table from cache since it is no longer usable
		this.tableCache.delete(oldTableName)

		const oldTableExists = this.tableExists(oldTableName)
		const newTableExists = this.tableExists(newTableName)

		// If old table doesn't exist, nothing to do
		if (!oldTableExists) {
			this.logger.info(`Skipping table rename from "${oldTableName}" to "${newTableName}": old table does not exist`)
			return
		}

		// If new table doesn't exist, simple rename
		if (!newTableExists) {
			this.logger.info(`Renaming table "${oldTableName}" to "${newTableName}"`)
			this.store.prepare(`ALTER TABLE ${oldTableName} RENAME TO ${newTableName}`).run()
			this.setDirty()
			return
		}

		// Both tables exist - need to merge them
		this.logger.info(`Merging table "${oldTableName}" into existing table "${newTableName}"`)

		try {
			// Get all rows from the old table
			const oldRows = this.store.prepare(`SELECT id, value FROM ${oldTableName}`).all()

			// Get existing IDs from the new table to avoid conflicts
			const newTableIds = new Set<string>(
				(this.store.prepare(`SELECT id FROM ${newTableName}`).all() as { id: string }[]).map((row) => row.id)
			)

			// Prepare insert statement for new table
			const insertStmt = this.store.prepare(
				`INSERT INTO ${newTableName} (id, value) VALUES (@id, @value) ON CONFLICT(id) DO UPDATE SET value = @value`
			)

			// Copy rows from old table to new table
			// Using transaction for better performance and atomicity
			this.store.prepare('BEGIN').run()
			try {
				for (const row of oldRows) {
					insertStmt.run(row)
				}

				this.store.prepare('COMMIT').run()
			} catch (e) {
				this.store.prepare('ROLLBACK').run()
				throw e
			}

			// Drop the old table
			this.store.prepare(`DROP TABLE ${oldTableName}`).run()

			this.logger.info(
				`Successfully merged ${oldRows.length} rows from "${oldTableName}" into "${newTableName}" (${newTableIds.size} existing rows, ${oldRows.length - newTableIds.size} new rows added)`
			)

			this.setDirty()
		} catch (e) {
			this.logger.error(`Error merging tables "${oldTableName}" and "${newTableName}": ${stringifyError(e)}`)
			throw e
		}
	}
}
