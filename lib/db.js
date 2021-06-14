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

const fs = require('fs-extra')
const path = require('path')
const { cloneDeep } = require('lodash')

module.exports = exports = function (system, cfgDir) {
	return new Database(system, cfgDir)
}

/**
 * The class that manages the applications's main database
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author Julian Waller <me@julusian.co.uk>
 * @author William Viker <william@bitfocus.io>
 * @since 1.0.4
 */
class Database {
	static SaveInterval = 4000

	cfgBakFile = null
	cfgCorruptFile = null
	cfgDir = null
	cfgFile = null
	cfgTmpFile = null
	debug = require('debug')('lib/db')
	defaults = {
		page_config_version: 3,
	}
	dirty = false
	lastsave = Date.now()
	name = 'db'
	saveInterval = null
	saving = false
	store = {}
	system = null

	/**
	 * Create a new application flat file DB controller
	 * @param {EventEmitter} system - the application's event emitter
	 * @param {string} cfgDir - the directory the flat file will be saved
	 */
	constructor(system, cfgDir) {
		this.system = system
		this.cfgDir = cfgDir
		this.cfgFile = path.join(cfgDir, this.name)
		this.cfgBakFile = path.join(cfgDir, this.name + '.bak')
		this.cfgCorruptFile = path.join(cfgDir, this.name + '.corrupt')
		this.cfgTmpFile = path.join(cfgDir, this.name + '.tmp')
		this.saveInterval = Database.SaveInterval

		this.system.on('db_dirty', this.setDirty.bind(this))

		this.system.on('db_all', (cb) => {
			if (typeof cb == 'function') {
				cb(this.getAll())
			}
		})

		this.system.on('db_set', this.setKey.bind(this))

		this.system.on('db_del', this.deleteKey.bind(this))

		this.system.on('db_set_multiple', this.setKeys.bind(this))

		this.system.on('db_get', (key, cb) => {
			if (typeof cb == 'function') {
				cb(this.getKey(key))
			}
		})

		this.system.on('db_save', () => {
			// Not wired ... interval has control
			//this.save()
		})

		this.loadSync()

		// db defaults
		if (this.store.userconfig === undefined) {
			this.store.userconfig = {}
			this.setDirty()
		}

		// is page up 1->2 or 2->1?
		if (this.store.userconfig.page_direction_flipped === undefined) {
			this.store.userconfig.page_direction_flipped = false
			this.setDirty()
		}
	}

	/**
	 * Delete a key/value pair
	 * @param {string} key - the key to be delete
	 * @access public
	 */
	deleteKey(key) {
		this.debug(`${this.name}_del (${key})`)
		if (key !== undefined) {
			delete this.store[key]
			this.setDirty()
		}
	}

	/**
	 * Save the database to file making a `FILE.bak` version then moving it into place
	 * @async
	 * @param {boolean} [withBackup = true] - can be set to <code>false</code> if the current file should not be moved to `FILE.bak`
	 * @access protected
	 */
	async doSave(withBackup) {
		const jsonSave = JSON.stringify(this.store)
		this.dirty = false
		this.lastsave = Date.now()

		if (withBackup === true) {
			try {
				const file = await fs.readFile(this.cfgFile, 'utf8')

				if (file.trim().length > 0) {
					JSON.parse(file) // just want to see if a parse error is thrown so we don't back up a corrupted db

					try {
						await fs.copy(this.cfgFile, this.cfgBakFile)
						this.debug(`${this.name}_save`, `backup written`)
					} catch (err) {
						this.debug(`${this.name}_save`, `Error making backup copy: ${err}`)
					}
				}
			} catch (err) {
				this.debug(`${this.name}_save`, `Error checking db file for backup: ${err}`)
			}
		}

		try {
			await fs.writeFile(this.cfgTmpFile, jsonSave)
		} catch (err) {
			this.debug(`${this.name}_save`, `Error saving: ${err}`)
			throw 'Error saving: ' + err
		}

		this.debug(`${this.name}_save`, 'written')

		try {
			await fs.rename(this.cfgTmpFile, this.cfgFile)
		} catch (err) {
			this.debug('db_save', `Error renaming ${this.name}.tmp: ` + err)
			throw `Error renaming ${this.name}.tmp: ` + err
		}

		this.debug(`${this.name}_save`, 'renamed')
		this.system.emit('db_saved', null)
	}

	/**
	 * Get the entire database
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Object[]} the database
	 * @access public
	 */
	getAll(clone = false) {
		let out
		this.debug(`${this.name}_all`)

		if (clone === true) {
			out = cloneDeep(this.store)
		} else {
			out = this.store
		}

		return out
	}

	/**
	 * @returns {string} the directory of the flat file
	 * @access public
	 */
	getCfgDir() {
		return this.cfgDir
	}

	/**
	 * Get a value from the database
	 * @param {string} key - the key to be retrieved
	 * @param {?Object[]} defaultValue - the default value to use if the key doesn't exist
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @access public
	 */
	getKey(key, defaultValue, clone = false) {
		let out
		this.debug(`${this.name}_get(${key})`)

		if (this.store[key] === undefined && defaultValue !== undefined) {
			this.store[key] = defaultValue
			this.setDirty()
		}

		if (clone === true) {
			out = cloneDeep(this.store[key])
		} else {
			out = this.store[key]
		}

		return out
	}

	/**
	 * Attempt to load the database from disk
	 * @access protected
	 */
	loadSync() {
		if (fs.existsSync(this.cfgFile)) {
			this.debug(this.cfgFile, 'exists. trying to read')

			try {
				let data = fs.readFileSync(this.cfgFile, 'utf8')

				if (data.trim().length > 0) {
					this.store = JSON.parse(data)
					this.debug('parsed JSON')
					this.system.emit(`${this.name}_loaded`, this.store)
				} else {
					this.system.emit(
						'log',
						this.name,
						'warn',
						`${this.name} was empty.  Attempting to recover the configuration.`
					)
					this.loadBackupSync(this.cfgBakFile)
				}
			} catch (e) {
				try {
					fs.copyFileSync(this.cfgFile, this.cfgCorruptFile)
					this.system.emit(
						'log',
						this.name,
						'error',
						`${this.name} could not be parsed.  A copy has been saved to ${this.cfgCorruptFile}.`
					)
					fs.rmSync(this.cfgFile)
				} catch (err) {
					this.debug(`${this.name}_load`, `Error making or deleting corrupted backup: ${err}`)
				}

				this.loadBackupSync(this.cfgBakFile)
			}
		} else if (fs.existsSync(this.cfgBakFile)) {
			this.system.emit('log', this.name, 'warn', `${this.name} is missing.  Attempting to recover the configuration.`)
			this.loadBackupSync(this.cfgBakFile)
		} else {
			this.debug(this.cfgFile, `doesn't exist. loading defaults`, this.defaults)
			this.loadDefaults()
		}

		this.setSaveCycle()
	}

	/**
	 * Attempt to load the backup file from disk as a recovery
	 * @access protected
	 */
	loadBackupSync() {
		if (fs.existsSync(this.cfgBakFile)) {
			this.debug(this.cfgBakFile, 'exists. trying to read')
			let data = fs.readFileSync(this.cfgBakFile, 'utf8')

			try {
				if (data.trim().length > 0) {
					this.store = JSON.parse(data)
					this.debug('parsed JSON')
					this.system.emit('log', this.name, 'warn', `${this.name}.bak has been used to recover the configuration.`)
					this.system.emit(`${this.name}_loaded`, this.store)
					this.save(false)
				} else {
					this.system.emit('log', this.name, 'warn', `${this.name} was empty.  Creating a new db.`)
					this.loadDefaults()
				}
			} catch (e) {
				throw e
			}
		} else {
			throw 'Could not load database file'
		}
	}

	/**
	 * Save the defaults since a file could not be found/loaded/parses
	 * @access protected
	 */
	loadDefaults() {
		this.store = cloneDeep(this.defaults)
		this.save()
	}

	/**
	 * Save the database to file
	 * @param {boolean} [withBackup = true] - can be set to `false` if the current file should not be moved to `FILE.bak`
	 * @access protected
	 */
	save(withBackup = true) {
		if (this.saving === false) {
			this.debug('db_save', 'begin')
			this.saving = true

			this.doSave(withBackup)
				.catch((err) => {
					try {
						this.system.emit('log', this.name, 'error', err)
					} catch (err2) {
						this.debug('db_save', 'Error reporting save failue: ' + err2)
					}
				})
				.then(() => {
					// This will run even if the catch caught an error
					this.saving = false
				})
		}
	}

	/**
	 * Execute a save if the database is dirty
	 * @access public
	 */
	saveImmediate() {
		if (this.dirty === true) {
			this.save()
		}
	}

	/**
	 * Register that there are changes in the database that need to be saved as soon as possible
	 * @access public
	 */
	setDirty() {
		this.dirty = true
	}

	/**
	 * Save/update a key/value pair to the database
	 * @param {(number|string)} key - the key to save under
	 * @param {Object} value - the object to save
	 * @access public
	 */
	setKey(key, value) {
		this.debug(`${this.name}_set(${key}, ${value})`)

		if (key !== undefined) {
			this.store[key] = value
			this.setDirty()
		}
	}

	/**
	 * Save/update multiple key/value pairs to the database
	 * @param {Array.<(number|string),Object>} keyvalueobj - the key to save under
	 * @access public
	 */
	setKeys(keyvalueobj) {
		this.debug(`${this.name}_set_multiple:`)

		if (keyvalueobj !== undefined && typeof keyvalueobj == 'object' && keyvalueobj.length > 0) {
			for (let key in keyvalueobj) {
				this.debug(`${this.name}_set(${key}, ${keyvalueobj[key]})`)
				this.store[key] = keyvalueobj[key]
			}

			this.setDirty()
		}
	}

	/**
	 * Setup the save cycle interval
	 * @access protected
	 */
	setSaveCycle() {
		this.saveCycle = setInterval(() => {
			// See if the database is dirty and needs to be saved
			if (Date.now() - this.lastsave > this.saveInterval && this.dirty) {
				this.save()
			}
		}, this.saveInterval)
	}
}
