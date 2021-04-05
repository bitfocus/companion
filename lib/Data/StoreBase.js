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
const { cloneDeep } = require('lodash')

/**
 * Abstract class to be extended by the flat file DB classes.
 * See {@link Config} and {@link Database}
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 * @abstract
 */
class DataStoreBase {
	cfgDir = null
	cfgFile = null
	defaults = null
	dirty = false
	lastsave = Date.now()
	name = null
	saveInterval = null
	store = {}
	system = null

	/**
	 * Create a new flat file DB controller
	 * @param {EventEmitter} system - the application's event emitter
	 * @param {string} name - the name of the flat file
	 * @param {string} cfgDir - the directory the flat file will be saved
	 * @param {number} saveInterval - minimum interval in ms to save to disk
	 * @param {Object[]} defaults - the default data to use when making a new file
	 */
	constructor(system, name, cfgDir, saveInterval, defaults) {
		this.system = system
		this.name = name
		this.cfgDir = cfgDir
		this.cfgFile = cfgDir + '/' + name
		this.saveInterval = saveInterval
		this.defaults = defaults
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
	 * Get the entire database
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Object[]} the database
	 * @access public
	 */
	getAll(clone = false) {
		let out
		this.debug(`${this.name}_get_all`)

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
	load() {
		let cfgBakFile = this.cfgFile + '.bak'

		if (fs.existsSync(this.cfgFile)) {
			this.debug(this.cfgFile, 'exists. trying to read')
			let data = fs.readFileSync(this.cfgFile, 'utf8')

			try {
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
					this.loadBackup(cfgBakFile)
				}
			} catch (e) {
				try {
					fs.copyFileSync(this.cfgFile, this.cfgFile + '.corrupt')
					this.system.emit(
						'log',
						this.name,
						'error',
						`${this.name} could not be parsed.  A copy has been saved to ${this.cfgFile}.corrupt.`
					)
					fs.rmSync(this.cfgFile)
				} catch (err) {
					this.debug(`${this.name}_load`, `Error making or deleting corrupted backup: ${err}`)
				}

				this.loadBackup(cfgBakFile)
			}
		} else if (fs.existsSync(cfgBakFile)) {
			this.system.emit('log', this.name, 'warn', `${this.name} is missing.  Attempting to recover the configuration.`)
			this.loadBackup(cfgBakFile)
		} else {
			this.loadDefaults()
		}

		this.setSaveCycle()
	}

	/**
	 * Attempt to load the backup file from disk as a recovery
	 * @param {string} cfgBakFile - the full file path
	 * @access protected
	 */
	loadBackup(cfgBakFile) {
		if (fs.existsSync(cfgBakFile)) {
			this.debug(cfgBakFile, 'exists. trying to read')
			let data = fs.readFileSync(cfgBakFile, 'utf8')

			try {
				if (data.trim().length > 0) {
					this.store = JSON.parse(data)
					this.debug('parsed JSON')
					this.system.emit('log', this.name, 'warn', `${this.name}.bak has been used to recover the configuration.`)
					this.system.emit(`${this.name}_loaded`, this.store)
					this.save(false)
				} else {
					this.loadDefaults()
				}
			} catch (e) {
				this.loadDefaults()
			}
		} else {
			this.loadDefaults()
		}
	}

	/**
	 * Save the defaults since a file could not be found/loaded/parses
	 * @access protected
	 */
	loadDefaults() {
		this.debug(this.cfgFile, 'didnt exist. loading defaults', this.defaults)
		this.system.emit(`${this.name}_loaded`, this.defaults)
		this.store = this.defaults
		this.save()
	}

	/**
	 * Save the database to file
	 * @param {boolean} [withBackup = true] - can be set to `false` if the current file should not be moved to `FILE.bak`
	 * @access protected
	 */
	save(withBackup = true) {
		if (withBackup === true && fs.existsSync(this.cfgFile) && fs.readFileSync(this.cfgFile, 'utf8').trim().length > 0) {
			fs.copy(this.cfgFile, this.cfgFile + '.bak', (err) => {
				if (err) {
					this.debug(`${this.name}_save`, `Error making backup copy: ${err}`)
				} else {
					this.debug(`${this.name}_save`, `backup written`)
				}

				this.saveMain()
			})
		} else {
			this.saveMain()
		}
	}

	/**
	 * Save the database to file making a `FILE.bak` version then moving it into place
	 * @access protected
	 */
	saveMain() {
		fs.writeFile(this.cfgFile + '.tmp', JSON.stringify(this.store), (err) => {
			if (err) {
				this.debug(`${this.name}_save`, `Error saving: ${err}`)
				return
			}

			this.debug(`${this.name}_save`, 'written')

			fs.rename(this.cfgFile + '.tmp', this.cfgFile, (err) => {
				if (err) {
					this.system.emit('log', this.name, 'error', `${this.name}.tmp->${this.name} failed: ${err}`)
				} else {
					this.debug(`${this.name}_save`, 'renamed')

					this.dirty = false
					this.lastsave = Date.now()
				}
			})
		})
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

exports = module.exports = DataStoreBase
