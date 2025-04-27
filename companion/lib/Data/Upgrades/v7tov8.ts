import type { DataStoreBase } from '../StoreBase.js'
import type { Logger } from '../../Log/Controller.js'
import type { SomeExportv4 } from '@companion-app/shared/Model/ExportModelv4.js'
import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'

/**
 * do the database upgrades to convert from the v6 to the v7 format
 */
function convertDatabaseToV8(db: DataStoreBase, logger: Logger) {
	if (!db.store) return

	convertCustomVariablesToTable(db, logger)
	convertConnectionsToTable(db, logger)

	// const controls = db.getTable('controls')

	// for (const [controlId, control] of Object.entries(controls)) {
	// 	// Fixup control
	// 	fixupControlEntities(control)

	// 	db.setTableKey('controls', controlId, control)
	// }
}

function convertCustomVariablesToTable(db: DataStoreBase, _logger: Logger) {
	// Create table
	db.store.prepare(`CREATE TABLE IF NOT EXISTS custom_variables (id STRING UNIQUE, value STRING);`).run()

	const oldCustomVariables = db.getKey('custom_variables')
	if (oldCustomVariables) {
		for (const [id, data] of Object.entries(oldCustomVariables)) {
			db.setTableKey('custom_variables', id, data)
		}
	}
	db.deleteKey('custom_variables')
}

function convertConnectionsToTable(db: DataStoreBase, _logger: Logger) {
	// Create table
	db.store.prepare(`CREATE TABLE IF NOT EXISTS connections (id STRING UNIQUE, value STRING);`).run()

	const oldConnections = db.getKey('instance')
	if (oldConnections) {
		for (const [id, data] of Object.entries(oldConnections)) {
			db.setTableKey('connections', id, data)
		}
	}
	db.deleteKey('instance')
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
