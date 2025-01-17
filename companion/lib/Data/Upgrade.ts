import LogController from '../Log/Controller.js'

import v1tov2 from './Upgrades/v1tov2.js'
import v2tov3 from './Upgrades/v2tov3.js'
import v3tov4 from './Upgrades/v3tov4.js'
import v4tov5 from './Upgrades/v4tov5.js'
import { showFatalError } from '../Resources/Util.js'
import type { DataDatabase } from './Database.js'
import type { SomeExportv6 } from '@companion-app/shared/Model/ExportModel.js'
import v5tov6 from './Upgrades/v5tov6.js'
import v6tov7 from './Upgrades/v6tov7.js'

const logger = LogController.createLogger('Data/Upgrade')

const allUpgrades = [
	v1tov2, // 15 to 32 key
	v2tov3, // v3.0
	v3tov4, // v3.2
	v4tov5, // v3.5 - first round of sqlite rearranging
	v5tov6, // v3.5 - replace action delay property https://github.com/bitfocus/companion/pull/3163
	v6tov7, // v3.6 - rework 'entities' for better nesting https://github.com/bitfocus/companion/pull/3185
]
const targetVersion = allUpgrades.length + 1

/**
 * Upgrade the db to the latest version.
 * This has the raw db object before anything else has gotten access, so no need to worry about other components getting confused
 */
export function upgradeStartup(db: DataDatabase): void {
	const currentVersion = db.getKey('page_config_version', 1)

	// Ensure that the db isnt too new
	if (currentVersion > targetVersion) {
		logger.error(`Upgrade from version ${currentVersion} to ${targetVersion} not possible: too new`)

		const message =
			'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.'
		showFatalError('Unbale to start companion', message)
		process.exit(1)
	} else if (currentVersion == targetVersion) {
		logger.debug(`Upgrade from version ${currentVersion} to ${targetVersion} not necessary`)
	} else {
		logger.info(`Upgrading db from version ${currentVersion} to ${targetVersion}`)

		// run the scripts
		for (let i = currentVersion; i < targetVersion; i++) {
			allUpgrades[i - 1].upgradeStartup(db, logger)

			// Record that the upgrade has been done
			db.setKey('page_config_version', i + 1)
		}
	}

	// Debug: uncomment to force the upgrade to run again
	// db.setKey('page_config_version', targetVersion - 1)
}

/**
 * Upgrade an exported page or full configuration to the latest format
 */
export function upgradeImport(obj: any): SomeExportv6 {
	const currentVersion = obj.version || 1

	for (let i = currentVersion; i < targetVersion; i++) {
		// Run if a script is defined
		if (!!allUpgrades[i - 1].upgradeImport) {
			obj = allUpgrades[i - 1].upgradeImport(obj, logger)
		}
	}

	obj.version = targetVersion
	return obj
}
