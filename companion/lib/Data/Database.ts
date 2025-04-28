import { DataStoreBase } from './StoreBase.js'
import { DataLegacyDatabase } from './Legacy/Database.js'
import { upgradeStartup } from './Upgrade.js'
import { createTables as createTablesV1 } from './Schema/v1.js'
import { createTables as createTablesV8 } from './Schema/v8.js'
import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'

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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
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
}
