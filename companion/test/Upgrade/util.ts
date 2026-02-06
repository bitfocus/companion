import { DataStoreTableView } from '../../lib/Data/StoreBase.js'

/**
 * Import raw data into a table
 * @param table - the table to import to
 * @param data - the data
 */
export function importTable(table: DataStoreTableView<any>, data: any) {
	if (data && typeof data === 'object') {
		for (const [key, value] of Object.entries(data)) {
			if (typeof value === 'string') {
				table.setPrimitive(key, value)
			} else {
				table.set(key, value)
			}
		}
	}
}
