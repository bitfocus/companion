import LogController from '../Log/Controller.js'
import fs from 'fs-extra'

import v1tov2 from './Upgrades/v1tov2.js'
import v2tov3 from './Upgrades/v2tov3.js'
import v3tov4 from './Upgrades/v3tov4.js'
import { showFatalError } from '../Resources/Util.js'
import DataDatabase from './Database.js'

const logger = LogController.createLogger('Data/Upgrade')

const allUpgrades = [
	v1tov2, // 15 to 32 key
	v2tov3, // v3.0
	v3tov4, // v3.2
]
const targetVersion = allUpgrades.length + 1

/**
 * Upgrade the db to the latest version.
 * This has the raw db object before anything else has gotten access, so no need to worry about other components getting confused
 * @param {DataDatabase} db
 */
export function upgradeStartup(db) {
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

		const saveUpgradeCopy = (/** @type {DataDatabase} */ db, /** @type {number} */ i) => {
			try {
				let jsonSave = db.getJSON()

				if (jsonSave !== undefined) {
					fs.writeFileSync(`${db.getCfgFile()}.v${i}`, jsonSave)
				}
			} catch (err) {
				logger.warn(`db_save: Error saving upgrade copy: ${err}`)
			}
		}

		// run the scripts
		for (let i = currentVersion; i < targetVersion; i++) {
			saveUpgradeCopy(db, i)
			allUpgrades[i - 1].upgradeStartup(db, logger)
		}

		db.setKey('page_config_version', targetVersion)

		// force a save
		db.saveImmediate()
	}
}

/**
 * Upgrade an exported page or full configuration to the latest format
 * @param {any} obj
 * @returns {import('../Shared/Model/ExportModel.js').SomeExportv4}
 */
export function upgradeImport(obj) {
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
