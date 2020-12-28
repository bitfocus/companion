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

const debug         = require('debug')('lib/Data/Config');
const DataStoreBase = require('./StoreBase');
const fs            = require('fs-extra');

const saveInterval = 5000; // Minimum 5 seconds between each save

class Config extends DataStoreBase {

	constructor(system, cfgDir, defaults) {
		super(system, 'config', debug, cfgDir, saveInterval, defaults);

		system.on('config_object', (cb) => {
			cb(this.getAll());
		});
		system.on('config_get', (key, cb) => {
			cb(this.getKey(key));
		});
		system.on('config_save', this.save.bind(this));
		system.on('config_set', this.setKey.bind(this));

		if (!fs.existsSync(this.cfgDir)) {
			this.debug("no config dir exists. creating:",this.cfgDir);
			fs.mkdirSync(this.cfgDir);
		}

		this.load();
	}
}

module.exports = exports = function (system, cfgDir, defaults) {
	return new Config(system, cfgDir, defaults);
};