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

/**
	Simple KVS that expects all data to fit in the frame.

	Events: (system object)
	* db_loaded (data) - All data
	* db_saved (err) - the db_save command was completed (or failed)

	Responds to events: (system object)
	* db_set (key, value) - Set key to value
	* db_get (key, cb) - Get value for key in large, emitter response to 'cb'
	* db_get_multiple ([key1, key2], cb) - Retrieves values for multiple keys, returns as array to 'cb'
	* db_save - Saves db from memory to file. Corresponds to db_saved. (look over)
*/

const saveInterval = 4000; // Minimum 4 seconds between each save

class db {

	constructor(system, cfgDir) {
		debug('new(db)');

		this.system = system;
		this.cfgDir = cfgDir;
		this.db = {};

		this.dirty = false;
		this.lastsave = 0;

		this.load();

		this.system.on("db_all", this.getAll.bind(this));

		this.system.on('db_set', this.setKeys.bind(this));

		this.system.on('db_del', this.deleteKey.bind(this));

		this.system.on('db_set_multiple', this.setKeys.bind(this));

		this.system.on('db_get', this.getKey.bind(this));
		this.system.on('db_get_multiple', this.getKeys.bind(this));

		this.system.on('db_save', this.save.bind(this));

		// Do a save sometime within the next 10 seconds
		this.system.on('db_dirty', this.setDirty.bind(this));

		// If last db_save was not handeled because of throttling, do it now
		this.saveCycle = setInterval(() => {
			if (Date.now() - this.lastsave > saveInterval && this.dirty) {
				this.save();
			}
		}, 4000);
	}

	deleteKey(key) {
		debug('db_del(' + key + ')');
		if (key !== undefined) {
			delete this.db[key];
		}
	}

	getAll(cb) {
		debug("db_all(): returning all database values");
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.db);
		}
	}

	getKey(key, cb) {
		debug('db_get(' + key + ')');
		if (cb !== undefined && typeof cb == 'function') {
			cb(this.db[key]);
		}
	}

	getKeys(keys, cb) {

		if (typeof keys != 'object' || typeof keys.length == 'undefined') {
			throw new Error('keys is not an array');
		}

		if (cb !== undefined && typeof cb == 'function') {
			cb(keys.map((key) => {
				return this.db[key];
			}));
		}
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

		if (Date.now() - this.lastsave > saveInterval) {
			debug("db_save","begin");

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
		else {
			this.setDirty(true);
		}
	}

	setDirty(dirty = true) {
		this.dirty = dirty;
	}

	setKey(key, value) {
		debug('db_set(' + key + ', ' + value + ')');
		if (key !== undefined) {
			this.db[key] = value;
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

module.exports = exports = function (system, cfgDir) {
	return new db(system, cfgDir);
};