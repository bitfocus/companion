/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */

const CoreBase = require('../Core/Base')

class DataUpgrade extends CoreBase {
	static Map12to32 = [2, 3, 4, 5, 10, 11, 12, 13, 18, 19, 20, 21]
	static Map15to32 = [1, 2, 3, 4, 5, 9, 10, 11, 12, 13, 17, 18, 19, 20, 21]

	debug = require('debug')('Data/Upgrade')

	constructor(registry, db) {
		super(registry, 'upgrade')
		this.dbLib = db
	}

	checkDbVersion() {
		let res = this.db.getKey('page_config_version')
		let db = this.db.getAll()

		if (res < 2 && db.length > 0) {
			this.upgradeV2(db)
		} else if (res > this.registry.fileVersion) {
			var dialog = require('electron').dialog
			dialog.showErrorBox(
				'Error starting companion',
				'You have previously installed a newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.'
			)
			process.exit(1)
		}
	}

	checkFileVersion(db) {
		let res = db.version
		let out = db

		if (res < 2 && db.length > 0) {
			db = this.upgradeV2(db)
		} else if (res > this.registry.fileVersion) {
			out = null
		}

		return out
	}
}

exports = module.exports = DataUpgrade
