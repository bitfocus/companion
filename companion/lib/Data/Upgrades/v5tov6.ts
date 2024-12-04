import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'

/**
 * do the database upgrades to convert from the v4 to the v5 format
 */
function convertDatabaseToV6(db: DataStoreBase, _logger: Logger) {
	if (!db.store) return

	const controls = db.getTable('controls')

	for (const [controlId, control] of Object.entries(controls)) {
		// TODO
	}

	// throw new Error('Not implemented')
	// 	try {
	// 		const controls = db.store.prepare(`CREATE TABLE IF NOT EXISTS controls (id STRING UNIQUE, value STRING);`)
	// 		controls.run()
	// 		const cloud = db.store.prepare(`CREATE TABLE IF NOT EXISTS cloud (id STRING UNIQUE, value STRING);`)
	// 		cloud.run()
	// 	} catch (e) {
	// 		_logger.warn(`Error creating tables`, e)
	// 	}

	// 	const batchInsert = function (table: string, heap: any) {
	// 		if (heap) {
	// 			for (const [key, value] of Object.entries(heap)) {
	// 				db.setTableKey(table, key, value)
	// 			}
	// 		}
	// 	}

	// 	// Move controls to their new table
	// 	const controls = db.getKey('controls')
	// 	batchInsert('controls', controls)
	// 	db.deleteKey('controls')

	// 	// Migrate the legacy cloud DB to its new table
	// 	try {
	// 		const clouddb = new DataLegacyCloudDatabase(db.cfgDir)
	// 		const cloud = clouddb.getAll()
	// 		batchInsert('cloud', cloud)
	// 	} catch (e: any) {}

	// 	// Move surface-groups to match others
	// 	const surfaces = db.getKey('surface-groups', {})
	// 	db.setKey('surface_groups', surfaces)
	// 	db.deleteKey('surface-groups')

	// 	db.setKey('page_config_version', 5)
}

function convertImportToV6(obj: any) {
	return obj
}

export default {
	upgradeStartup: convertDatabaseToV6,
	upgradeImport: convertImportToV6,
}
