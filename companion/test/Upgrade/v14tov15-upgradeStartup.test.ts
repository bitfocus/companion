import { beforeAll, describe, expect, it } from 'vitest'
import { createTables } from '../../lib/Data/Schema/v1.js'
import { DataStoreBase } from '../../lib/Data/StoreBase.js'
import v14tov15 from '../../lib/Data/Upgrades/v14tov15.js'
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

function makeSurface(groupId: string | null, neverLock: boolean | undefined) {
	const config: Record<string, any> = { brightness: 100 }
	if (neverLock !== undefined) config.never_lock = neverLock

	return {
		config,
		groupConfig: { name: 'Auto group' },
		groupId,
	}
}

describe('v14tov15 upgradeStartup', () => {
	const db = new DataDatabase()
	const logger = LogController.createLogger('test-logger')

	beforeAll(() => {
		const surfaces = db.getTableView('surfaces')
		const groups = db.getTableView('surface_groups')

		// Auto-group surfaces (not part of an explicit group)
		surfaces.set('auto-locked', makeSurface(null, true))
		surfaces.set('auto-unlocked', makeSurface(null, false))

		// Members of an explicit group with mixed never_lock - the group should end up locked-exempt
		surfaces.set('member-a', makeSurface('explicit-1', false))
		surfaces.set('member-b', makeSurface('explicit-1', true))

		// Members of a second explicit group, none exempt
		surfaces.set('member-c', makeSurface('explicit-2', false))

		// A surface from before the field existed - must be left alone
		surfaces.set('legacy', makeSurface(null, undefined))

		groups.set('explicit-1', { name: 'Group One', use_last_page: true })
		groups.set('explicit-2', { name: 'Group Two', use_last_page: true })

		v14tov15.upgradeStartup(db, logger)
	})

	it('moves never_lock onto an auto-group surface own group config', () => {
		const surface = db.getTableView('surfaces').get('auto-locked')
		expect(surface.config.never_lock).toBeUndefined()
		expect(surface.groupConfig.never_lock).toBe(true)
	})

	it('preserves a false never_lock on an auto-group surface', () => {
		const surface = db.getTableView('surfaces').get('auto-unlocked')
		expect(surface.config.never_lock).toBeUndefined()
		expect(surface.groupConfig.never_lock).toBe(false)
	})

	it('removes never_lock from explicit group members but does not store it on the surface', () => {
		const surfaces = db.getTableView('surfaces')
		expect(surfaces.get('member-a').config.never_lock).toBeUndefined()
		expect(surfaces.get('member-b').config.never_lock).toBeUndefined()
		// The auto group config is not the source of truth for explicit-group members
		expect(surfaces.get('member-a').groupConfig.never_lock).toBeUndefined()
		expect(surfaces.get('member-b').groupConfig.never_lock).toBeUndefined()
	})

	it('OR-merges never_lock from members onto the explicit group', () => {
		expect(db.getTableView('surface_groups').get('explicit-1').never_lock).toBe(true)
	})

	it('sets never_lock false on an explicit group where no member was exempt', () => {
		expect(db.getTableView('surface_groups').get('explicit-2').never_lock).toBe(false)
	})

	it('leaves a surface without the field untouched', () => {
		const surface = db.getTableView('surfaces').get('legacy')
		expect('never_lock' in surface.config).toBe(false)
		expect('never_lock' in surface.groupConfig).toBe(false)
	})

	it('is idempotent when run again', () => {
		// Snapshot the migrated state
		const before = {
			surfaces: db.getTableView('surfaces').all(),
			groups: db.getTableView('surface_groups').all(),
		}

		v14tov15.upgradeStartup(db, logger)

		expect(db.getTableView('surfaces').all()).toEqual(before.surfaces)
		expect(db.getTableView('surface_groups').all()).toEqual(before.groups)
	})
})
