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

var debug = require('debug')('lib/config');
var fs    = require('fs-extra');

class Config {

	constructor(system, cfgDir, defaults) {
		this.store = {};
		this.cfgDir = cfgDir
		this.defaults = defaults;
		this.lastsave = Date.now();

		system.on('config_object', this.getAll.bind(this));
		system.on('config_get', this.getValue.bind(this));
		system.on('config_save', this.save.bind(this));
		system.on('config_set', this.setValue.bind(this));

		var config_file = this.cfgDir + '/config';

		if (!fs.existsSync(this.cfgDir)) {
			debug("no config dir exists. creating:",this.cfgDir);
			fs.mkdirSync(this.cfgDir);
		}

		if (fs.existsSync(config_file)) {
			debug(config_file,"exists. trying to read");
			var data = fs.readFileSync(config_file);
			try {
				this.store = JSON.parse(data);
				debug("parsed JSON");
			} catch(e) {
				this.store = {};
				debug("going default");
			}
			system.emit('config_loaded', this.store);
		}
		else {
			debug(config_file,"didnt exist. loading blank", this.defaults);
			system.emit('config_loaded', this.defaults);
			this.store = this.defaults;
			this.changed = true;
			this.save();
		}

		setInterval(() => {
			if (this.changed) {
				debug('interval-save');
				this.save();
			}
		}, 5000);
	}

	getAll(cb) {
		debug("config_object()");
		cb(this.store);
	}

	getValue(key, cb) {
		debug('config_get(' + key + ')');
		cb(this.store[key]);
	}

	save() {
		var now = Date.now();
		debug("config_save(): begin");

		if (now - this.lastsave > 2000) {
			fs.writeFile(this.cfgDir + '/config.tmp', JSON.stringify(this.store), (err) => {
				debug("config_save(): rename config.tmp");

				if (err) {
					debug('Error saving: ', err);
					return;
				}

				fs.rename(this.cfgDir + '/config.tmp', this.cfgDir + '/config', (err) => {

					if (err) {
						debug('Error renaming: ', err);
						return;
					}

					this.lastsave = Date.now();
					this.changed = false;

					debug('config written');
				})
			});
		}
	}

	setValue(key, value) {
		debug('config_set(' + key + ')');
		this.store[key] = value;
		this.changed = true;
		this.save();
	}
}

module.exports = exports = function (system, cfgDir, defaults) {
	return new Config(system, cfgDir, defaults);
};