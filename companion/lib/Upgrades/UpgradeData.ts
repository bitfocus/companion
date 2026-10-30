import type { DataDatabaseDefaultTable } from '../Data/Database.js'
import type { DataStoreBase } from '../Data/StoreBase.js'
import LogController, { type Logger } from '../Log/Controller.js'
import { showFatalError } from '../Resources/Util.js'
import { convertDatabaseToV18 } from './Data/v17tov18.js'
import { LEGACY_VERSION, legacyUpgrades } from './LegacyUpgrades.js'

const logger = LogController.createLogger('Upgrades/UpgradeData')

export type DataUpgradeStep = (logger: Logger, db: DataStoreBase<any>) => void

/** The steps that upgrade the db, after the legacy steps */
const dataUpgrades: DataUpgradeStep[] = [
	convertDatabaseToV18, // v5.2 - store the cloud uuid as JSON, and the userconfig of an existing db
]

/** The version of the db */
export const DATA_VERSION = LEGACY_VERSION + dataUpgrades.length

/**
 * Upgrade the db to the latest version.
 * This has the raw db object before anything else has gotten access, so no need to worry about other components getting confused
 */
export function upgradeStartup(db: DataStoreBase<DataDatabaseDefaultTable>): void {
	const currentVersion = db.defaultTableView.getOrDefault('page_config_version', 1)

	// Ensure that the db isnt too new
	if (currentVersion > DATA_VERSION) {
		logger.error(`Upgrade from version ${currentVersion} to ${DATA_VERSION} not possible: too new`)

		const message =
			'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.'
		showFatalError('Unbale to start companion', message)
		// eslint-disable-next-line n/no-process-exit
		process.exit(1)
	} else if (currentVersion == DATA_VERSION) {
		logger.debug(`Upgrade from version ${currentVersion} to ${DATA_VERSION} not necessary`)
	} else {
		logger.info(`Upgrading db from version ${currentVersion} to ${DATA_VERSION}`)

		// run the scripts
		for (let i = currentVersion; i < DATA_VERSION; i++) {
			if (i < LEGACY_VERSION) {
				legacyUpgrades[i - 1].upgradeStartup(db, logger)
			} else {
				dataUpgrades[i - LEGACY_VERSION](logger, db)
			}

			// Record that the upgrade has been done
			db.defaultTableView.set('page_config_version', i + 1)
		}
	}

	// Debug: uncomment to force the upgrade to run again
	// TODO: comment out again before release. Reruns the in-progress Data/v17tov18 step on every start, as it is still being added to
	db.defaultTableView.set('page_config_version', DATA_VERSION - 1)
}
