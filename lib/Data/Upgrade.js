const debug = require('debug')('lib/Data/Upgrade')
const fs = require('fs-extra')

const v1tov2 = require('./Upgrades/v1tov2')
const v2tov3 = require('./Upgrades/v2tov3')

const allUpgrades = [
	v1tov2, // 15 to 32 key
	v2tov3, // actions and release_actions to action_sets
]
const targetVersion = allUpgrades.length + 1

/**
 * Upgrade the db to the latest version.
 * This has the raw db object before anything else has gotten access, so no need to worry about other components getting confused
 */
module.exports.startup = function (db) {
	const currentVersion = db.getKey('page_config_version', 1)

	// Ensure that the db isnt too new
	if (currentVersion > targetVersion) {
		debug(`Upgrade from version ${currentVersion} to ${targetVersion} not possible: too new`)

		const message =
			'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.'
		const dialog = require('electron').dialog
		if (dialog) {
			dialog.showErrorBox('Error starting companion', message)
		} else {
			console.error(message)
		}
		process.exit(1)
	} else if (currentVersion == targetVersion) {
		debug(`Upgrade from version ${currentVersion} to ${targetVersion} not necessary`)
	} else {
		debug(`Upgrading db from version ${currentVersion} to ${targetVersion}`)

		const saveUpgradeCopy = (db, i) => {
			try {
				let jsonSave = db.getJSON()

				if (jsonSave !== undefined) {
					fs.writeFileSync(`${db.getCfgFile()}.v${i}`, jsonSave)
				}
			} catch (err) {
				debug(`db_save`, `Error saving upgrade copy: ${err}`)
			}
		}

		let upgradePerformed = false
		// run the scripts
		for (let i = currentVersion; i < targetVersion; i++) {
			saveUpgradeCopy(db, i)
			allUpgrades[i - 1].startup(db)
		}

		db.setKey('page_config_version', targetVersion)

		// force a save
		db.saveImmediate()
	}
}

/**
 * Upgrade an exported page or full configuration to the latest format
 */
module.exports.upgradeImport = function (obj) {
	const currentVersion = obj.version || 1

	for (let i = currentVersion; i < targetVersion; i++) {
		// Run if a script is defined
		if (allUpgrades[i - 1].import) {
			obj = allUpgrades[i - 1].import(obj)
		}
	}

	obj.version = targetVersion
	return obj
}
