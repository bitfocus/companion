import { DataLegacyCloudDatabase } from '../Legacy/CloudDatabase.js'
import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'

/**
 * do the database upgrades to convert from the v4 to the v5 format
 */
function convertDatabaseToV5(db: DataStoreBase<any>, _logger: Logger): void {
	if (db.store) {
		const batchInsert = function (table: string, heap: any) {
			if (heap) {
				const controlsTable = db.getTableView(table)
				for (const [key, value] of Object.entries(heap)) {
					controlsTable.set(key, value)
				}
			}
		}

		const mainTable = db.defaultTableView

		// Move controls to their new table
		const controls = mainTable.get('controls')
		batchInsert('controls', controls)
		mainTable.delete('controls')

		// Migrate the legacy cloud DB to its new table
		try {
			const clouddb = new DataLegacyCloudDatabase(db.cfgDir)
			const cloud = clouddb.getAll()
			batchInsert('cloud', cloud)
		} catch (_e: any) {
			// Ignore errors here, as the cloud DB may not exist
		}

		// Move surface-groups to match others
		const surfaces = mainTable.get('surface-groups') ?? {}
		mainTable.set('surface_groups', surfaces)
		mainTable.delete('surface-groups')

		mainTable.set('page_config_version', 5)
	}
}

function convertImportToV5(obj: SomeExportv4): SomeExportv4 {
	return obj
}

export default {
	upgradeStartup: convertDatabaseToV5,
	upgradeImport: convertImportToV5,
}
