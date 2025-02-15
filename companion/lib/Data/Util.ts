import Database, { Database as SQLiteDB } from 'better-sqlite3'

// Manual path to the prebuilt binary, to strip down the
const nativeBinding =
	typeof __non_webpack_require__ === 'function'
		? (__non_webpack_require__('./prebuilds/better_sqlite3.node') as any)
		: undefined

/**
 * Create a new SQLite database, handling the native binding once packaged
 * @param filename Filename of the database, or :memory: for in-memory
 * @returns
 */
export function createSqliteDatabase(filename: string): SQLiteDB {
	return new Database(filename, {
		nativeBinding,
	})
}
