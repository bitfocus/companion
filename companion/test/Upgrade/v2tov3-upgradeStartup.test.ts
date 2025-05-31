import { describe, it, expect, vi } from 'vitest'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import LogController from '../../lib/Log/Controller.js'
import v2tov3 from '../../lib/Data/Upgrades/v2tov3.js'
import { createTables } from '../../lib/Data/Schema/v1.js'
import fs from 'fs-extra'
import { SuppressLogging } from '../Util.js'
import { importTable } from './util.js'

let nano = 0

vi.mock('nanoid', () => {
	return { nanoid: () => '' + ++nano }
})

function CreateDataDatabase() {
	const db = new DataDatabase()

	let data = fs.readFileSync('./companion/test/Upgrade/v2tov3/db.v2.json', 'utf8')
	data = JSON.parse(data)

	importTable(db.defaultTableView, data)

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
	SuppressLogging()

	it('empty', () => {
		const db = CreateDataDatabase()
		v2tov3.upgradeStartup(db, LogController.createLogger('test-logger'))
		let data = fs.readFileSync('./companion/test/Upgrade/v2tov3/db.v3.json', 'utf8')
		data = JSON.parse(data)
		expect(db.getTableView('main').all()).toEqual(data)
	})
})
