import { DataStoreBase } from './StoreBase.js'
import { DataLegacyDatabase } from './Legacy/Database.js'
import { upgradeStartup } from './Upgrade.js'
import { createTables as createTablesV1 } from './Schema/v1.js'
import { createTables as createTablesV8 } from './Schema/v8.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import fs from 'fs/promises'

export interface DataDatabaseDefaultTable {
	page_config_version: number
	userconfig: UserConfigModel
}

/**
 * The class that manages the applications's main database
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.4
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class DataDatabase extends DataStoreBase<DataDatabaseDefaultTable> {
	/**
	 * @param configDir - the root config directory
	 */
	constructor(configDir: string) {
		super(configDir, 'db', 'main', 'Data/Database')

		this.startSQLite()

		upgradeStartup(this)
	}

	/**
	 * Create the database tables
	 */
	protected create(): void {
		createTablesV8(this.store, this.defaultTable, this.logger)
	}

	/**
	 * Save the defaults since a file could not be found/loaded/parsed
	 */
	protected loadDefaults(): void {
		this.defaultTableView.set('page_config_version', 6)

		this.isFirstRun = true
	}

	/**
	 * Load the old file driver and migrate to SQLite
	 */
	protected migrateFileToSqlite(): void {
		createTablesV1(this.store, this.defaultTable, this.logger)

		const legacyDB = new DataLegacyDatabase(this.cfgDir)

		const data = legacyDB.getAll()

		for (const [key, value] of Object.entries(data)) {
			this.defaultTableView.set(key as any, value)
		}
	}

	/**
	 * Create a backup copy of the database to the specified path
	 * @param filePath Path to save the backup
	 * @returns Promise resolving to the file size in bytes
	 */
	public async createBackup(filePath: string): Promise<number> {
		// Ensure the database is synced to disk before backing up
		this.store.pragma('wal_checkpoint(TRUNCATE)')

		// Use SQLite's backup functionality to copy the database
		await this.store.backup(filePath)

		// Get the file size of the created backup
		try {
			const stats = await fs.stat(filePath)
			return stats.size
		} catch (error) {
			this.logger.error(`Failed to get file size for backup: ${error}`)
			return 0
		}
	}
}
