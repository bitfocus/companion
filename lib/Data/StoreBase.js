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

var fs = require('fs-extra');

class DataStoreBase {

	constructor(system, name, debug, cfgDir, saveInterval, defaults) {
		this.system       = system;
		this.name         = name;
		this.debug        = debug;
		this.cfgDir       = cfgDir;
		this.cfgFile      = cfgDir + '/' + name;
		this.store        = {};
		this.dirty        = false;
		this.lastsave     = Date.now();
		this.saveInterval = saveInterval;
		this.defaults     = defaults;
	}

	deleteKey(key) {
		this.debug(`${this.name}_del (${key})`);
		if (key !== undefined) {
			delete this.store[key];
		}
	}

	getAll() {
		this.debug(`${this.name}_get_all`);
		return this.store
	}

	getKey(key, defaultValue) {
		this.debug(`${this.name}_get(${key})`);

		if (this.store[key] === undefined && defaultValue !== undefined) {
			this.store[key] = defaultValue;
			this.setDirty();
		}

		return this.store[key];
	}

	load() {		

		if (fs.existsSync(this.cfgFile)) {
			this.debug(this.cfgFile,"exists. trying to read");
			var data = fs.readFileSync(this.cfgFile);
			try {
				this.store = JSON.parse(data);
				this.debug("parsed JSON");
			} catch(e) {
				fs.copy(this.cfgFile, this.cfgFile + '.corrupt', (err) => {
					if (err) {
						this.debug(`${this.name}_load`, `Error making corrupted backup: ${err}`);
					}
					else {
						this.system.emit('log', this.name, 'error', `${this.name} could not be parsed.  A copy has been saved to ${this.cfgFile}.corrupt and a new file has been created.`);
					}
				});
				this.store = this.defaults;
				this.debug("going default");
			}
			this.system.emit(`${this.name}_loaded`, this.store);
		}
		else {
			this.debug(this.cfgFile,"didnt exist. loading defaults", this.defaults);
			this.system.emit(`${this.name}_loaded`, this.defaults);
			this.store = this.defaults;
			this.save();
		}

		this.setSaveCycle();
	}

	save() {

		fs.copy(this.cfgFile, this.cfgFile + '.bak', (err) => {

			if (err) {
				this.debug(`${this.name}_save`, `Error making backup copy: ${err}`);
			}

			fs.writeFile(this.cfgFile + '.tmp', JSON.stringify(this.store), (err) => {
				if (err) {
					this.debug(`${this.name}_save`, `Error saving: ${err}`);
					return;
				}

				this.debug(`${this.name}_save`, 'written');

				fs.rename(this.cfgFile + '.tmp', this.cfgFile, (err) => {

					if (err) {
						this.system.emit('log', this.name, 'error', `${this.name}.tmp->${this.name} failed: ${err}`);
					}
					else {
						this.debug(`${this.name}_save`,'renamed');

						this.setDirty(false);				
						this.lastsave = Date.now();
					}
				});
			});
		});
	}

	setDirty(dirty = true) {
		this.dirty = dirty;
	}

	setKey(key, value) {
		this.debug(`${this.name}_set(${key}, ${value})`);

		if (key !== undefined) {
			this.store[key] = value;
			this.setDirty();
		}
	}

	setKeys(keyvalueobj) {
		this.debug(`${this.name}_set_multiple:`);

		if (keyvalueobj !== undefined && typeof keyvalueobj == 'object' && keyvalueobj.length > 0) {
			for (var key in keyvalueobj) {
				this.debug(`${this.name}_set(${key}, ${keyvalueobj[key]})`);
				this.store[key] = keyvalueobj[key];
			}

			this.setDirty();
		}
	}

	setSaveCycle() {
		// If last db_save was not handeled because of throttling, do it now
		this.saveCycle = setInterval(() => {
			if (Date.now() - this.lastsave > this.saveInterval && this.dirty) {
				this.save();
			}
		}, this.saveInterval);
	}
}

exports = module.exports = DataStoreBase;