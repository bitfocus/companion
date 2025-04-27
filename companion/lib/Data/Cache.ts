import { DataStoreBase } from './StoreBase.js'
import { DataLegacyCache } from './Legacy/Cache.js'

/**
 * The class that manages the applications's disk cache
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
export class DataCache extends DataStoreBase {
	/**
	 * @param configDir - the root config directory
	 */
	constructor(configDir: string) {
		super(configDir, 'cache', 'main', 'Data/Cache')

		this.startSQLite()
	}

	/**
	 * Create the database tables
	 */
	protected create(): void {
		if (this.store) {
			const create = this.store.prepare(
				`CREATE TABLE IF NOT EXISTS ${this.defaultTable} (id STRING UNIQUE, value STRING);`
			)
			try {
				create.run()
			} catch (e) {
				this.logger.warn(`Error creating table ${this.defaultTable}`)
			}
		}
	}

	/**
	 * Save the defaults since a file could not be found/loaded/parsed
	 */
	protected loadDefaults(): void {
		this.setTableKey(this.defaultTable, 'cloud_servers', {})

		this.isFirstRun = true
	}

	/**
	 * Skip loading migrating the old DB to SQLite
	 */
	protected migrateFileToSqlite(): void {
		this.create()

		const legacyDB = new DataLegacyCache(this.cfgDir)

		const data = legacyDB.getAll()

		for (const [key, value] of Object.entries(data)) {
			this.setKey(key, value)
		}
	}
}
