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

const debug         = require('debug')('lib/Data/Database');
const DataStoreBase = require('./StoreBase');
const DataUpgrade   = require('./Upgrade');

const saveInterval = 4000; // Minimum 4 seconds between each save

class Database extends DataStoreBase {

	constructor(registry) {
		super(registry.system, 'db', debug, registry.getCfgDir(), saveInterval, {});
		this.registry = registry;

		this.load();

		if (this.debug.page_config_version !== undefined) {
			const upgrade = new DataUpgrade(registry, this);
			db = upgrade.checkDbVersion();

			if (db === null) {
				var dialog = require('electron').dialog;
				dialog.showErrorBox('Error starting companion', 'You have previously installed a much newer version of companion. Since the configuration files are incompatible between major versions of companion, you need to remove the old config before continuing with this version.');
				process.exit(1);
			} else {
				this.db = db;
			}
		}
		else {
			this.db.page_config_version = this.registry.getFileVersion();
		}
	}
}

exports = module.exports = Database;