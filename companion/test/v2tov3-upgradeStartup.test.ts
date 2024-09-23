import { describe, it, expect } from 'vitest'
import { DataStoreBase, DatabaseDefault } from '../lib/Data/StoreBase.js'
import LogController from '../lib/Log/Controller.js'
import v2tov3 from '../lib/Data/Upgrades/v2tov3.js'
import { createTables } from '../lib/Data/Schema/v1.js'

function CreateDataDatabase() {
	const db = new DataDatabase()
	console.log('Got: ')
	console.log(db.store)

	return db
}

class DataDatabase extends DataStoreBase {
	static Defaults: DatabaseDefault = {
		main: {
			page_config_version: 3,
		},
	}
	constructor() {
		super(':memory:', '', 'main', 'Data/Database')
		this.startSQLite()
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {
		for (const [key, value] of Object.entries(DataDatabase.Defaults)) {
			for (const [key2, value2] of Object.entries(value)) {
				this.setTableKey(key, key2, value2)
			}
		}

		this.isFirstRun = true
	}
	protected migrateFileToSqlite(): void {}
}

describe('upgrade', () => {
	it('empty', () => {
		const db = CreateDataDatabase()
		v2tov3.upgradeStartup(db, LogController.createLogger('test-logger'))
		expect(db.getTable('main')).toEqual({
			bank_rotate_left_actions: {},
			bank_rotate_right_actions: {},
			controls: {},
			page_config_version: 3,
		})
	})
})
