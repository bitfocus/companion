import { beforeAll, describe, expect, it } from 'vitest'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import v9tov10 from '../../lib/Data/Upgrades/v9tov10.js'
import LogController from '../../lib/Log/Controller.js'

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

function findSurfaceInstances(db: DataDatabase, moduleId: string) {
	const instances = db.getTableView('instances').all()
	return Object.values(instances).filter((instance: any) => instance?.moduleId === moduleId)
}

describe('v9tov10 upgradeStartup', () => {
	const db = new DataDatabase()
	const logger = LogController.createLogger('test-logger')

	beforeAll(() => {
		db.defaultTableView.set('userconfig', {
			xkeys_enable: true,
			contour_shuttle_enable: false,
			mystrix_enable: false,
			loupedeck_enable: false,
		})

		const surfaces = db.getTableView('surfaces')
		// A configured surface for an integration that was disabled - the user has used it before
		surfaces.set('surf-contour', { integrationType: 'contour-shuttle', config: {}, groupConfig: {} })
		// A configured surface whose old integrationType differs from the new moduleId
		surfaces.set('surf-mystrix', { integrationType: '203-mystrix', config: {}, groupConfig: {} })

		v9tov10.upgradeStartup(db, logger)
	})

	it('creates a disabled instance for a disabled integration that has a known surface', () => {
		const instances = findSurfaceInstances(db, 'contour-shuttle')
		expect(instances).toHaveLength(1)
		expect(instances[0].enabled).toBe(false)
	})

	it('maps an old integrationType alias to the new moduleId', () => {
		const instances = findSurfaceInstances(db, '203-systems-mystrix')
		expect(instances).toHaveLength(1)
		expect(instances[0].enabled).toBe(false)
	})

	it('does not create an instance for a disabled integration without a known surface', () => {
		expect(findSurfaceInstances(db, 'loupedeck')).toHaveLength(0)
	})

	it('creates an enabled instance for an enabled integration', () => {
		const instances = findSurfaceInstances(db, 'xkeys')
		expect(instances).toHaveLength(1)
		expect(instances[0].enabled).toBe(true)
	})

	it('is idempotent when run again', () => {
		const before = db.getTableView('instances').all()

		v9tov10.upgradeStartup(db, logger)

		expect(db.getTableView('instances').all()).toEqual(before)
	})
})
