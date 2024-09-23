import { describe, it, expect } from 'vitest'
import { DataTestBase } from '../lib/Data/TestBase.js'
import { DataDatabase } from '../lib/Data/Database.js'
import LogController from '../lib/Log/Controller.js'
import v2tov3 from '../lib/Data/Upgrades/v2tov3.js'
import { cloneDeep } from 'lodash-es'

function CreateDataDatabase(dbContents: any) {
	const db = new DataTestBase(DataDatabase.Defaults, 'main', 'Data/Database')
	// Bypass loading data properly and just set it to our test data
	for( const [key, value] of Object.entries(dbContents)) {
		db.setKey(key, value)
	}
	console.log('Got: ')
	console.log(db.store)

	return db
}

describe('upgrade', () => {
	it('empty', () => {
		const db = CreateDataDatabase(DataDatabase.Defaults)
		v2tov3.upgradeStartup(db, LogController.createLogger('test-logger'))
		expect(db.getTable('main')).toEqual({
			bank_rotate_left_actions: {},
			bank_rotate_right_actions: {},
			controls: {},
			page_config_version: 3,
		})
	})
})
