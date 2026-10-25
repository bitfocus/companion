import { describe, expect, it } from 'vitest'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import v17tov18 from '../../lib/Data/Upgrades/v17tov18.js'
import LogController from '../../lib/Log/Controller.js'

class DataDatabase extends DataStoreBase<any> {
	constructor() {
		super(':memory:', '', 'main', 'Data/Database', () => {})
		this.startSQLite()
	}
	protected create(): void {
		createTables(this.store, this.defaultTable, this.logger)
	}
	protected loadDefaults(): void {}
	protected migrateFileToSqlite(): void {}
}

describe('v17tov18 upgradeStartup', () => {
	const logger = LogController.createLogger('test-logger')

	it.each([
		['a uuid', '6c1d3c1a-6f5e-4c36-9d5a-1f2b3c4d5e6f'],
		['a machine id of only digits, which would parse as a number', '1234567890'],
	])('stores %s as JSON, leaving the other rows alone', (_name, uuid) => {
		const db = new DataDatabase()
		const cloud = db.getTableView('cloud')
		cloud.setPrimitive('uuid', uuid)
		cloud.set('auth', { token: 'abc' })

		v17tov18.upgradeStartup(db, logger)
		expect(cloud.get('uuid')).toBe(uuid)
		expect(cloud.get('auth')).toEqual({ token: 'abc' })

		// Running again changes nothing
		v17tov18.upgradeStartup(db, logger)
		expect(cloud.get('uuid')).toBe(uuid)
	})

	it('does nothing without a uuid, or a cloud table', () => {
		const db = new DataDatabase()
		v17tov18.upgradeStartup(db, logger)
		expect(db.tableExists('cloud')).toBe(false)

		const cloud = db.getTableView('cloud')
		v17tov18.upgradeStartup(db, logger)
		expect(cloud.all()).toEqual({})
	})
})
