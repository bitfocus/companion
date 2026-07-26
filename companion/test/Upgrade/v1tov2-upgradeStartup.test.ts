import fs from 'fs-extra'
import { describe, expect, it } from 'vitest'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import v1tov2 from '../../lib/Data/Upgrades/v1tov2.js'
import LogController from '../../lib/Log/Controller.js'
import { importTable } from './util.js'

function CreateDataDatabase() {
	const db = new DataDatabase()

	const data = fs.readFileSync('./companion/test/Upgrade/v1tov2/db.v1.json', 'utf8')

	importTable(db.defaultTableView, JSON.parse(data))

	return db
}

class DataDatabase extends DataStoreBase<any> {
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
	it('empty', () => {
		const db = CreateDataDatabase()
		v1tov2.upgradeStartup(db, LogController.createLogger('test-logger'))
		let data = fs.readFileSync('./companion/test/Upgrade/v1tov2/db.v2.json', 'utf8')
		data = JSON.parse(data)
		expect(db.getTableView('main').all()).toEqual(data)
	})
})
