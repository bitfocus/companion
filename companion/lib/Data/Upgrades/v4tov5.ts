import { DataLegacyCloudDatabase } from '../Legacy/CloudDatabase.js'
import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'

/**
 * do the database upgrades to convert from the v4 to the v5 format
 */
function convertDatabaseToV5(db: DataStoreBase, _logger: Logger) {
	if (db.store) {
		try {
			const controls = db.store.prepare(`CREATE TABLE IF NOT EXISTS controls (id STRING UNIQUE, value STRING);`)
			controls.run()
			const cloud = db.store.prepare(`CREATE TABLE IF NOT EXISTS cloud (id STRING UNIQUE, value STRING);`)
			cloud.run()
		} catch (e) {
			_logger.warn(`Error creating tables`, e)
		}

		const batchInsert = function (table: string, heap: any) {
			if (heap) {
				for (const [key, value] of Object.entries(heap)) {
					db.setTableKey(table, key, value)
				}
			}
		}

		// Move controls to their new table
		const controls = db.getKey('controls')
		batchInsert('controls', controls)
		db.deleteKey('controls')

		// Migrate the legacy cloud DB to its new table
		try {
			const clouddb = new DataLegacyCloudDatabase(db.cfgDir)
			const cloud = clouddb.getAll()
			batchInsert('cloud', cloud)
		} catch (e: any) {}

		// Move surface-groups to match others
		const surfaces = db.getKey('surface-groups', {})
		db.setKey('surface_groups', surfaces)
		db.deleteKey('surface-groups')

		db.setKey('page_config_version', 5)
	}
}

function convertImportToV5(obj: SomeExportv4): SomeExportv4 {
	return obj
}

export default {
	upgradeStartup: convertDatabaseToV5,
	upgradeImport: convertImportToV5,
}
