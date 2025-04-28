import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'
import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'

/**
 * do the database upgrades to convert from the v6 to the v7 format
 */
function convertDatabaseToV8(db: DataStoreBase<any>, _logger: Logger) {
	if (!db.store) return

	convertRowToTable(db, 'custom_variables', 'custom_variables')
	convertRowToTable(db, 'connections', 'instance')
	convertRowToTable(db, 'pages', 'page')
	convertRowToTable(db, 'surfaces', 'deviceconfig')
	convertRowToTable(db, 'surface_groups', 'surface_groups')
	convertRowToTable(db, 'surfaces_remote', 'outbound_surfaces')
}

function convertRowToTable(db: DataStoreBase<any>, tableName: string, oldKey: string) {
	// Create table
	const tableView = db.getTableView(tableName)

	const mainTable = db.defaultTableView

	const oldValues = mainTable.get(oldKey)
	if (oldValues) {
		for (const [id, data] of Object.entries(oldValues)) {
			tableView.set(id, data)
		}
	}
	mainTable.delete(oldKey)
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
