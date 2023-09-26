import Registry from '../lib/Registry.js'
import DataStoreBase from '../lib/Data/StoreBase.js'
import DataDatabase from '../lib/Data/Database.js'
import LogController from '../lib/Log/Controller.js'
import v2tov3 from '../lib/Data/Upgrades/v2tov3.js'

function CreateDataDatabase(dbContents) {
	const registry = new Registry('test/config/empty/', 'foo')
	const db = new DataStoreBase(registry, 'db', 4000, DataDatabase.defaults, 'Data/Database')
	// Bypass loading and just set it to our test data
	db.store = dbContents
	console.log("Got: ")
	console.log(db.store)

	return db
}

describe('upgrade', () => {
	it('empty', () => {
		const db = CreateDataDatabase(DataDatabase.Defaults)
		const result = v2tov3.upgradeStartup(db, LogController.createLogger('foo'))
		console.log(result)
		console.log(db.store)
		expect(db.store).toEqual({
			page_config_version: 3
		})
	})
})
