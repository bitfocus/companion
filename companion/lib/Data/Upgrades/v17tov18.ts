import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DataStoreBase } from '../StoreBase.js'

/**
 * Store the cloud uuid as JSON, as every other row is, rather than as a raw string
 */
function convertDatabaseToV18(db: DataStoreBase<any>, _logger: Logger): void {
	if (!db.store || !db.tableExists('cloud')) return

	// Read it raw, as a uuid of only digits would parse as JSON. The column's numeric affinity also stores one as a number
	const row = db.store.prepare(`SELECT value FROM cloud WHERE id = 'uuid'`).get() as
		{ value: string | number } | undefined
	if (row === undefined) return

	// Already stored as JSON. A raw uuid or machine id can't be a JSON string, as it has no quotes
	if (typeof row.value === 'string' && row.value.startsWith('"')) return

	db.store.prepare(`UPDATE cloud SET value = ? WHERE id = 'uuid'`).run(JSON.stringify(String(row.value)))
}

function convertImportToV18(obj: SomeExportv6, _logger: Logger): SomeExportv6 {
	// Exports do not include the cloud table, so there is nothing to transform beyond the version bump.
	return { ...structuredClone(obj), version: 18 }
}

export default {
	upgradeStartup: convertDatabaseToV18,
	upgradeImport: convertImportToV18,
}
