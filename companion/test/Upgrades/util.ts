import type { DataStoreBase } from '../../lib/Data/StoreBase.js'
import { setRawRow } from '../utils/RawRows.js'

/**
 * Import raw data into the default table, storing strings as they are, as old dbs did
 * @param db - the db to import to
 * @param data - the data
 */
export function importTable(db: DataStoreBase<any>, data: Record<string, any>): void {
	if (data && typeof data === 'object') {
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'string') {
				setRawRow(db.store, 'main', key, value)
			} else {
				db.defaultTableView.set(key, value)
			}
		}
	}
}
