import fs from 'fs-extra'
import path from 'path'
import { cloneDeep } from 'lodash-es'
import LogController from '../Log/Controller.js'
import { showErrorMessage } from '../Resources/Util.js'

/**
 * Abstract class to be extended by the flat file DB classes.
 * See {@link DataCache} and {@link DataDatabase}
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class DataStoreBase {
	/**
	 * The full backup file path
	 * @type {string}
	 * @access protected
	 */
	cfgBakFile = ''
	/**
	 * The full corrupt file path
	 * @type {string}
	 * @access protected
	 */
	cfgCorruptFile = ''
	/**
	 * The config directory
	 * @type {string}
	 * @access protected
	 */
	cfgDir = ''
	/**
	 * The full main file path
	 * @type {string}
	 * @access protected
	 */
	cfgFile = ''
	/**
	 * The full temporary file path
	 * @type {string}
	 * @access protected
	 */
	cfgTmpFile = ''
	/**
	 * The stored defaults for a new store
	 * @type {Object}
	 * @access protected
	 */
	defaults = {}
	/**
	 * Flag to tell the <code>saveInternal</code> there's
	 * changes to save to disk
	 * @type {boolean}
	 * @access protected
	 */
	dirty = false
	/**
	 * Flag if this database was created fresh on this run
	 * @type {boolean}
	 * @access protected
	 */
	isFirstRun = false
	/**
	 * Timestamp of last save to disk
	 * @type {number}
	 * @access protected
	 */
	lastsave = Date.now()
	/**
	 * The name to use for the file and logging
	 * @type {string}
	 * @access protected
	 */
	name = ''

	/**
	 * The time to use for the save interval
	 * @type {?NodeJS.Timeout}
	 * @access protected
	 */
	saveCycle

	/**
	 * The interval to fire a save to disk when dirty
	 * @type {number}
	 * @access protected
	 */
	saveInterval

	/**
	 * Semaphore while the store is saving to disk
	 * @type {boolean}
	 * @access protected
	 */
	saving = false

	/**
	 * The flat file DB in RAM
	 * @type {Record<string, any>}
	 * @access protected
	 */
	store = {}

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, name, saveInterval, defaults, debug)</code>.
	 * @param {string} configDir - the root config directory
	 * @param {string} name - the name of the flat file
	 * @param {number} saveInterval - minimum interval in ms to save to disk
	 * @param {Object} defaults - the default data to use when making a new file
	 * @param {string} debug - module path to be used in the debugger
	 */
	constructor(configDir, name, saveInterval, defaults, debug) {
		this.logger = LogController.createLogger(debug)

		this.cfgDir = configDir
		this.name = name
		this.saveInterval = saveInterval
		this.defaults = defaults

		this.cfgFile = path.join(this.cfgDir, this.name)
		this.cfgBakFile = path.join(this.cfgDir, this.name + '.bak')
		this.cfgCorruptFile = path.join(this.cfgDir, this.name + '.corrupt')
		this.cfgTmpFile = path.join(this.cfgDir, this.name + '.tmp')
	}

	/**
	 * Delete a key/value pair
	 * @param {string} key - the key to be delete
	 * @access public
	 */
	deleteKey(key) {
		this.logger.silly(`${this.name}_del (${key})`)
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
						this.logger.silly(`${this.name}_save: backup written`)
					} catch (err) {
						this.logger.silly(`${this.name}_save: Error making backup copy: ${err}`)
					}
				}
			} catch (err) {
				this.logger.silly(`${this.name}_save: Error checking db file for backup: ${err}`)
			}
		}

		try {
			await fs.writeFile(this.cfgTmpFile, jsonSave)
		} catch (err) {
			this.logger.silly(`${this.name}_save: Error saving: ${err}`)
			throw 'Error saving: ' + err
		}

		this.logger.silly(`${this.name}_save: written`)

		try {
			await fs.rename(this.cfgTmpFile, this.cfgFile)
		} catch (err) {
			this.logger.silly(`${this.name}_save: Error renaming ${this.name}.tmp: ` + err)
			throw `Error renaming ${this.name}.tmp: ` + err
		}

		this.logger.silly(`${this.name}_save: renamed`)
	}

	/**
	 * Get the entire database
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @returns {Record<string, any>} the database
	 * @access public
	 */
	getAll(clone = false) {
		let out
		this.logger.silly(`${this.name}_all`)

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
	 * @returns {string} the flat file
	 * @access public
	 */
	getCfgFile() {
		return this.cfgFile
	}

	/**
	 * @returns {boolean} the 'is first run' flag
	 * @access public
	 */
	getIsFirstRun() {
		return this.isFirstRun
	}

	/**
	 * @returns {string | void} JSON of the database
	 * @access public
	 */
	getJSON() {
		try {
			return JSON.stringify(this.store)
		} catch (e) {
			this.logger.silly(`JSON error: ${e}`)
		}
	}

	/**
	 * Get a value from the database
	 * @param {string} key - the key to be retrieved
	 * @param {?any} defaultValue - the default value to use if the key doesn't exist
	 * @param {boolean} [clone = false] - <code>true</code> if a clone is needed instead of a link
	 * @access public
	 */
	getKey(key, defaultValue, clone = false) {
		let out
		this.logger.silly(`${this.name}_get(${key})`)

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
	 * Checks if the database has a value
	 * @param {string} key - the key to be checked
	 * @access public
	 */
	hasKey(key) {
		return this.store[key] !== undefined
	}

	/**
	 * Attempt to load the database from disk
	 * @access protected
	 */
	loadSync() {
		if (fs.existsSync(this.cfgFile)) {
			this.logger.silly(this.cfgFile, 'exists. trying to read')

			try {
				let data = fs.readFileSync(this.cfgFile, 'utf8')

				if (data.trim().length > 0 || data.startsWith('\0')) {
					this.store = JSON.parse(data)
					this.logger.silly('parsed JSON')
				} else {
					this.logger.warn(`${this.name} was empty.  Attempting to recover the configuration.`)
					this.loadBackupSync()
				}
			} catch (e) {
				try {
					fs.copyFileSync(this.cfgFile, this.cfgCorruptFile)
					this.logger.error(`${this.name} could not be parsed.  A copy has been saved to ${this.cfgCorruptFile}.`)
					fs.rmSync(this.cfgFile)
				} catch (err) {
					this.logger.silly(`${this.name}_load`, `Error making or deleting corrupted backup: ${err}`)
				}

				this.loadBackupSync()
			}
		} else if (fs.existsSync(this.cfgBakFile)) {
			this.logger.warn(`${this.name} is missing.  Attempting to recover the configuration.`)
			this.loadBackupSync()
		} else {
			this.logger.silly(this.cfgFile, `doesn't exist. loading defaults`, this.defaults)
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
			this.logger.silly(this.cfgBakFile, 'exists. trying to read')
			let data = fs.readFileSync(this.cfgBakFile, 'utf8')

			try {
				if (data.trim().length > 0 || data.startsWith('\0')) {
					this.store = JSON.parse(data)
					this.logger.silly('parsed JSON')
					this.logger.warn(`${this.name}.bak has been used to recover the configuration.`)
					this.save(false)
				} else {
					this.logger.warn(`${this.name} was empty.  Creating a new db.`)
					this.loadDefaults()
				}
			} catch (e) {
				showErrorMessage('Error starting companion', 'Could not load database backup  file. Resetting configuration')

				console.error('Could not load database backup file')
				this.loadDefaults()
			}
		} else {
			showErrorMessage('Error starting companion', 'Could not load database backup  file. Resetting configuration')

			console.error('Could not load database file')
			this.loadDefaults()
		}
	}

	/**
	 * Save the defaults since a file could not be found/loaded/parses
	 * @access protected
	 */
	loadDefaults() {
		this.store = cloneDeep(this.defaults)
		this.isFirstRun = true
		this.save()
	}

	/**
	 * Save the database to file
	 * @param {boolean} [withBackup = true] - can be set to `false` if the current file should not be moved to `FILE.bak`
	 * @access protected
	 */
	save(withBackup = true) {
		if (this.saving === false) {
			this.logger.silly(`${this.name}_save: begin`)
			this.saving = true

			this.doSave(withBackup)
				.catch((err) => {
					try {
						this.logger.error(err)
					} catch (err2) {
						this.logger.silly(`${this.name}_save: Error reporting save failure: ${err2}`)
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
	 * @access protected
	 */
	setDirty() {
		this.dirty = true
	}

	/**
	 * Save/update a key/value pair to the database
	 * @param {(number|string|string[])} key - the key to save under
	 * @param {Object | undefined} value - the object to save
	 * @access public
	 */
	setKey(key, value) {
		this.logger.silly(`${this.name}_set(${key}, ${value})`)

		if (key !== undefined) {
			if (Array.isArray(key)) {
				if (key.length > 0) {
					const keyStr = key.join(':')
					const lastK = key.pop()

					// Find or create the parent object
					let dbObj = this.store
					for (const k of key) {
						if (!dbObj || typeof dbObj !== 'object') throw new Error(`Unable to set db path: ${keyStr}`)
						if (!dbObj[k]) dbObj[k] = {}
						dbObj = dbObj[k]
					}

					// @ts-ignore
					dbObj[lastK] = value
					this.setDirty()
				}
			} else {
				this.store[key] = value
				this.setDirty()
			}
		}
	}

	// /**
	//  * Save/update multiple key/value pairs to the database
	//  * @param {Array.<(number|string),Object>} keyvalueobj - the key to save under
	//  * @access public
	//  */
	// setKeys(keyvalueobj) {
	// 	this.logger.silly(`${this.name}_set_multiple:`)

	// 	if (keyvalueobj !== undefined && typeof keyvalueobj == 'object' && keyvalueobj.length > 0) {
	// 		for (let key in keyvalueobj) {
	// 			this.logger.silly(`${this.name}_set(${key}, ${keyvalueobj[key]})`)
	// 			this.store[key] = keyvalueobj[key]
	// 		}

	// 		this.setDirty()
	// 	}
	// }

	/**
	 * Setup the save cycle interval
	 * @access protected
	 */
	setSaveCycle() {
		if (this.saveCycle) return

		this.saveCycle = setInterval(() => {
			// See if the database is dirty and needs to be saved
			if (Date.now() - this.lastsave > this.saveInterval && this.dirty) {
				this.save()
			}
		}, this.saveInterval)
	}
}

export default DataStoreBase
