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


var debug = require('debug')('lib/db');
var fs    = require('fs-extra');

const saveInterval = 4000; // Minimum 4 seconds between each save

class DB {

	constructor(registry) {
		this.registry = registry
		this.system = this.registry.system;
		this.cfgDir = this.registry.getCfgDir();
		debug('new(db)');
		this.db = {};

		this.dirty = false;
		this.lastsave = 0;

		this.load();

		//this.system.on('db_save', this.save.bind(this));

		// If last db_save was not handeled because of throttling, do it now
		this.saveCycle = setInterval(() => {
			if (Date.now() - this.lastsave > saveInterval && this.dirty) {
				this.save();
			}
		}, saveInterval);
	}

	deleteKey(key) {
		debug('db_del(' + key + ')');
		if (key !== undefined) {
			delete this.db[key];
		}
	}

	getAll() {
		debug("db_all: returning all database values");
		return this.db
	}

	getKey(key, def) {
		debug('db_get(' + key + ')');

		if (this.db[key] === undefined && def !== undefined) {
			this.db[key] = def;
		}

		return this.db[key];
	}

	load() {
		try {
			var data = fs.readFileSync(this.cfgDir + '/db');

			this.db = JSON.parse(data);
			debug('db loaded');

			var changed_after_load = false;
			// db defaults
			if (this.db.userconfig === undefined) {
				this.db.userconfig = {};
				changed_after_load = true;
			}

			// is page up 1->2 or 2->1?
			if (this.db.userconfig.page_direction_flipped === undefined) {
				this.db.userconfig.page_direction_flipped = false;
				changed_after_load = true;
			}

			this.system.emit('db_loaded', this.db);

			if (changed_after_load === true) {
				debug('config changed by default values after load, saving.');
				this.save();
			}
		}
		catch (err) {

			if (err.code == 'ENOENT') {
				debug("readFile(db)","Couldnt read db, loading {}");
				this.system.emit('db_loaded', {});
			} else {
				throw err;
			}
		}
	}

	save() {
		this.setDirty(false);

		this.lastsave = Date.now();

		fs.copy(this.cfgDir + '/db', this.cfgDir + '/db.bak', (err) => {

			if (err) {
				debug('db_save', 'Error making backup of config: ' + err);
			}

			fs.writeFile(this.cfgDir + '/db.tmp', JSON.stringify(this.db), (err) => {
				if (err) {
					debug('db_save', 'Error saving: ' + err);
					this.system.emit('db_saved', err);
					return;
				}

				debug("db_save","written");

				fs.rename(this.cfgDir + '/db.tmp', this.cfgDir + '/db', (err) => {

					if (err) {
						this.system.emit('log', 'CORE(cb)', 'error', 'db.tmp->db failed: ' + err);
					}
					else {
						debug('db_save','renamed');
						this.system.emit('db_saved', null);
					}
				});
			});
		});
	}

	setDirty(dirty = true) {
		this.dirty = dirty;
	}

	setKey(key, value) {
		debug('db_set(' + key + ', ' + value + ')');
		if (key !== undefined) {
			this.db[key] = value;
			this.setDirty();
		}
	}

	setKeys(keyvalueobj) {
		debug('db_set_multiple:');
		for (var key in keyvalueobj) {
			debug('db_set(' + key + ',' + keyvalueobj[key] + ')');
			this.db[key] = keyvalueobj[key];
		}
	}
}

exports = module.exports = DB;