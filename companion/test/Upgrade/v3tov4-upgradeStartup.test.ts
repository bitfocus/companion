import { describe, it, expect } from 'vitest'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import LogController from '../../lib/Log/Controller.js'
import v3tov4 from '../../lib/Data/Upgrades/v3tov4.js'
import { createTables } from '../../lib/Data/Schema/v1.js'
import fs from 'fs-extra'
import { SuppressLogging } from '../Util.js'

function CreateDataDatabase() {
	const db = new DataDatabase()

	let data = fs.readFileSync('./companion/test/Upgrade/v3tov4/db.v3.json', 'utf8')
	data = JSON.parse(data)

	db.importTable('main', data)

	return db
}

class DataDatabase extends DataStoreBase {
	constructor() {
		super(':memory:', '', 'main', 'Data/Database')
		this.startSQLite()
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {}
	protected migrateFileToSqlite(): void {}
}

describe('upgrade', () => {
	SuppressLogging()

	it('empty', () => {
		const db = CreateDataDatabase()
		v3tov4.upgradeStartup(db, LogController.createLogger('test-logger'))
		let data = fs.readFileSync('./companion/test/Upgrade/v3tov4/db.v4.json', 'utf8')
		data = JSON.parse(data)
		expect(db.getTable('main')).toEqual(data)
	})
})
