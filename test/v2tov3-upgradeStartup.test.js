import DataStoreBase from '../lib/Data/StoreBase.js'
import DataDatabase from '../lib/Data/Database.js'
import LogController from '../lib/Log/Controller.js'
import v2tov3 from '../lib/Data/Upgrades/v2tov3.js'
import { cloneDeep } from 'lodash-es'

function CreateDataDatabase(dbContents) {
	const db = new DataStoreBase('test/config/empty/', 'db', 4000, DataDatabase.defaults, 'Data/Database')
	// Bypass loading data properly and just set it to our test data
	db.store = cloneDeep(dbContents)
	console.log('Got: ')
	console.log(db.store)

	return db
}

describe('upgrade', () => {
	it('empty', () => {
		const db = CreateDataDatabase(DataDatabase.Defaults)
		const result = v2tov3.upgradeStartup(db, LogController.createLogger('test-logger'))
		expect(db.store).toEqual({
			bank_rotate_left_actions: {},
			bank_rotate_right_actions: {},
			controls: {},
			page_config_version: 3,
		})
	})
})
