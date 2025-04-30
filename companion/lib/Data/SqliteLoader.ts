import fs from 'fs-extra'
import type { Logger } from '../Log/Controller.js'
import { Database as SQLiteDB } from 'better-sqlite3'
import type { DataStorePaths } from './StoreBase.js'
import { createSqliteDatabase } from './Util.js'

interface LoadSqliteResult {
	store: SQLiteDB
	state: DatabaseStartupState
}

export enum DatabaseStartupState {
	Normal = 0,
	Reset = 1,
	RAM = 2,
	NeedsUpgrade = 3,
}

export function loadSqliteDatabase(logger: Logger, cfgPaths: DataStorePaths, storeName: string): LoadSqliteResult {
	if (cfgPaths.cfgDir == ':memory:') {
		const store = createSqliteDatabase(cfgPaths.cfgDir)

		return {
			store,
			state: DatabaseStartupState.RAM,
		}
	} else {
		if (fs.existsSync(cfgPaths.cfgFile)) {
			logger.silly(`${cfgPaths.cfgFile} exists. trying to read`)

			try {
				const store = createDatabase(logger, cfgPaths.cfgFile)

				return {
					store,
					state: DatabaseStartupState.Normal,
				}
			} catch (e) {
				try {
					try {
						if (fs.existsSync(cfgPaths.cfgCorruptFile)) {
							fs.rmSync(cfgPaths.cfgCorruptFile)
						}

						fs.moveSync(cfgPaths.cfgFile, cfgPaths.cfgCorruptFile)
						logger.error(`${storeName} could not be parsed.  A copy has been saved to ${cfgPaths.cfgCorruptFile}.`)
					} catch (e: any) {
						logger.error(`${storeName} could not be parsed.  A copy could not be saved.`)
					}
				} catch (err) {
					logger.silly(`${storeName} load Error making or deleting corrupted backup: ${err}`)
				}

				return startSQLiteWithBackup(logger, cfgPaths)
			}
		} else if (fs.existsSync(cfgPaths.cfgBakFile)) {
			logger.warn(`${storeName} is missing.  Attempting to recover the configuration.`)
			return startSQLiteWithBackup(logger, cfgPaths)
		} else if (fs.existsSync(cfgPaths.cfgLegacyFile)) {
			try {
				const store = createDatabase(logger, cfgPaths.cfgFile)
				logger.info(`Legacy ${cfgPaths.cfgLegacyFile} exists.  Attempting migration to SQLite.`)

				return {
					store,
					state: DatabaseStartupState.NeedsUpgrade,
				}
			} catch (e: any) {
				logger.error(e.message)
				return startSQLiteWithDefaults(logger, cfgPaths)
			}
		} else {
			logger.silly(cfgPaths.cfgFile, `doesn't exist. loading defaults`)
			return startSQLiteWithDefaults(logger, cfgPaths)
		}
	}
}

function createDatabase(logger: Logger, filename: string) {
	const db = createSqliteDatabase(filename)

	try {
		db.pragma('journal_mode = WAL')
	} catch (err) {
		logger.warn(`Error setting journal mode: ${err}`)
	}

	return db
}

/**
 * Attempt to load the backup file from disk as a recovery
 */
function startSQLiteWithBackup(logger: Logger, cfgPaths: DataStorePaths): LoadSqliteResult {
	if (fs.existsSync(cfgPaths.cfgBakFile)) {
		logger.silly(`${cfgPaths.cfgBakFile} exists. trying to read`)
		try {
			try {
				fs.rmSync(cfgPaths.cfgFile)
			} catch (e) {}

			fs.copyFileSync(cfgPaths.cfgBakFile, cfgPaths.cfgFile)
			const store = createDatabase(logger, cfgPaths.cfgFile)

			return {
				store,
				state: DatabaseStartupState.Normal, // Technically restored, but we don't track that
			}
		} catch (e: any) {
			logger.error(e.message)
			return startSQLiteWithDefaults(logger, cfgPaths)
		}
	} else {
		return startSQLiteWithDefaults(logger, cfgPaths)
	}
}

/**
 * Attempt to start a fresh DB and load the defaults
 */
function startSQLiteWithDefaults(logger: Logger, cfgPaths: DataStorePaths): LoadSqliteResult {
	try {
		if (fs.existsSync(cfgPaths.cfgFile)) {
			fs.rmSync(cfgPaths.cfgFile)
		}
	} catch (e: any) {}

	const store = createDatabase(logger, cfgPaths.cfgFile)

	return {
		store,
		state: DatabaseStartupState.Reset,
	}
}
