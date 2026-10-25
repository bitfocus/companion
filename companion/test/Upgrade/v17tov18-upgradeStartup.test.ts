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

	/** Upgrade a config, checking that running the upgrade again changes nothing */
	function upgradeUserConfig(userconfig: Record<string, unknown> | undefined) {
		const db = new DataDatabase()
		if (userconfig) db.defaultTableView.set('userconfig', userconfig)
		v17tov18.upgradeStartup(db, logger)
		const upgraded = db.defaultTableView.get('userconfig')

		v17tov18.upgradeStartup(db, logger)
		expect(db.defaultTableView.get('userconfig')).toEqual(upgraded)

		return upgraded
	}

	describe('userconfig', () => {
		it('keeps the old services and behaviour of a config without any service setting', () => {
			expect(upgradeUserConfig({ setup_wizard: 22 })).toEqual({
				setup_wizard: 22,

				// The legacy services are kept enabled with their old ports
				detailed_data_collection: true,
				tcp_enabled: true,
				tcp_listen_port: 51234,
				udp_enabled: true,
				udp_listen_port: 51235,
				osc_enabled: true,
				osc_listen_port: 12321,
				emberplus_enabled: true,

				// Old behaviour is preserved
				usb_hotplug: false,
				osc_legacy_api_enabled: true,
				tcp_legacy_api_enabled: true,
				udp_legacy_api_enabled: true,
				http_api_enabled: true,
				http_legacy_api_enabled: true,
			})
		})

		it('only fills in the settings missing from a config with any service setting', () => {
			expect(upgradeUserConfig({ setup_wizard: 22, osc_enabled: false, tcp_enabled: true })).toEqual({
				setup_wizard: 22,
				osc_enabled: false,
				tcp_enabled: true,
				usb_hotplug: false,
				tcp_legacy_api_enabled: true,
				http_api_enabled: true,
				http_legacy_api_enabled: true,
			})
		})

		it('changes nothing in a config that has every setting', () => {
			const userconfig = {
				usb_hotplug: true,
				tcp_enabled: true,
				tcp_legacy_api_enabled: false,
				http_api_enabled: false,
				http_legacy_api_enabled: false,
			}
			expect(upgradeUserConfig(userconfig)).toEqual(userconfig)
		})

		it('does nothing without a config', () => {
			expect(upgradeUserConfig(undefined)).toBeUndefined()
		})
	})

	describe('cloud uuid', () => {
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
})
