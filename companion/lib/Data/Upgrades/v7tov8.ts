import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'
import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'

/**
 * do the database upgrades to convert from the v6 to the v7 format
 */
function convertDatabaseToV8(db: DataStoreBase, _logger: Logger) {
	if (!db.store) return

	convertRowToTable(db, 'custom_variables', 'custom_variables')
	convertRowToTable(db, 'connections', 'instance')
	convertRowToTable(db, 'pages', 'page')
	convertRowToTable(db, 'surfaces', 'deviceconfig')
	convertRowToTable(db, 'surface_groups', 'surface_groups')
	convertRowToTable(db, 'surfaces_remote', 'outbound_surfaces')
}

function convertRowToTable(db: DataStoreBase, tableName: string, oldKey: string) {
	// Create table
	db.store.prepare(`CREATE TABLE IF NOT EXISTS ${tableName} (id STRING UNIQUE, value STRING);`).run()

	const oldCustomVariables = db.getKey(oldKey)
	if (oldCustomVariables) {
		for (const [id, data] of Object.entries(oldCustomVariables)) {
			db.setTableKey(tableName, id, data)
		}
	}
	db.deleteKey(oldKey)
}

function convertImportToV8(obj: SomeExportv4): SomeExportv6 {
	return {
		...obj,
		version: 8,
	}
}

export default {
	upgradeStartup: convertDatabaseToV8,
	upgradeImport: convertImportToV8,
}
