import { describe, it, expect } from 'vitest'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import LogController from '../../lib/Log/Controller.js'
import v4tov5 from '../../lib/Data/Upgrades/v4tov5.js'
import { createTables } from '../../lib/Data/Schema/v1.js'
import fs from 'fs-extra'
import { SuppressLogging } from '../Util.js'

function CreateDataDatabase() {
	const db = new DataDatabase()

	let data = fs.readFileSync('./companion/test/Upgrade/v4tov5/db.v4.json', 'utf8')
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

	const db = CreateDataDatabase()
	let data = fs.readFileSync('./companion/test/Upgrade/v4tov5/db.v5.json', 'utf8')
	data = JSON.parse(data)
	v4tov5.upgradeStartup(db, LogController.createLogger('test-logger'))
	it('main', () => {
		expect(db.getTable('main')).toEqual(data['main'])
	})
	it('controls', () => {
		expect(db.getTable('controls')).toEqual(data['controls'])
	})
})
