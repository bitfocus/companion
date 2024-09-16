import fs from 'fs-extra'
import path from 'path'
import { cloneDeep } from 'lodash-es'
import LogController, { Logger } from '../Log/Controller.js'
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
export class DataStoreBase {
	protected readonly logger: Logger

	/**
	 * The full backup file path
	 */
	private readonly cfgBakFile: string = ''
	/**
	 * The full corrupt file path
	 */
	private readonly cfgCorruptFile: string = ''
	/**
	 * The config directory
	 */
	private readonly cfgDir: string = ''
	/**
	 * The full main file path
	 */
	private readonly cfgFile: string = ''
	/**
	 * The full temporary file path
	 */
	private readonly cfgTmpFile: string = ''
	/**
	 * The stored defaults for a new store
	 */
	private readonly defaults: object = {}
	/**
	 * Flag to tell the <code>saveInternal</code> there's
	 * changes to save to disk
	 */
	private dirty = false
	/**
	 * Flag if this database was created fresh on this run
	 */
	private isFirstRun = false
	/**
	 * Timestamp of last save to disk
	 */
	private lastsave = Date.now()
	/**
	 * The name to use for the file and logging
	 */
	private readonly name: string = ''

	/**
	 * The time to use for the save interval
	 */
	private saveCycle: NodeJS.Timeout | undefined

	/**
	 * The interval to fire a save to disk when dirty
	 * @type {number}
	 * @access protected
	 */
	private readonly saveInterval: number

	/**
	 * Semaphore while the store is saving to disk
	 */
	private saving = false

	/**
	 * The flat file DB in RAM
	 */
	private store: Record<string, any> = {}

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, name, saveInterval, defaults, debug)</code>.
	 * @param configDir - the root config directory
	 * @param name - the name of the flat file
	 * @param saveInterval - minimum interval in ms to save to disk
	 * @param defaults - the default data to use when making a new file
	 * @param debug - module path to be used in the debugger
	 */
	constructor(configDir: string, name: string, saveInterval: number, defaults: object, debug: string) {
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
	 * @param key - the key to be delete
	 */
	deleteKey(key: string): void {
		this.logger.silly(`${this.name}_del (${key})`)
		if (key !== undefined) {
			delete this.store[key]
			this.setDirty()
		}
	}

	/**
	 * Save the database to file making a `FILE.bak` version then moving it into place
	 * @param withBackup - can be set to <code>false</code> if the current file should not be moved to `FILE.bak`
	 */
	protected async doSave(withBackup = true): Promise<void> {
		const jsonSave = JSON.stringify(this.store)
		this.dirty = false
		this.lastsave = Date.now()

		if (withBackup) {
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
	 * @param clone - <code>true</code> if a clone is needed instead of a link
	 * @returns the database
	 */
	getAll(clone = false): Record<string, any> {
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
	 * @returns the directory of the flat file
	 */
	getCfgDir(): string {
		return this.cfgDir
	}

	/**
	 * @returns the flat file
	 */
	getCfgFile(): string {
		return this.cfgFile
	}

	/**
	 * @returns the 'is first run' flag
	 */
	getIsFirstRun(): boolean {
		return this.isFirstRun
	}

	/**
	 * @returns JSON of the database
	 */
	getJSON(): string | null {
		try {
			return JSON.stringify(this.store)
		} catch (e) {
			this.logger.silly(`JSON error: ${e}`)
			return null
		}
	}

	/**
	 * Get a value from the database
	 * @param key - the key to be retrieved
	 * @param defaultValue - the default value to use if the key doesn't exist
	 * @param clone - <code>true</code> if a clone is needed instead of a link
	 */
	getKey(key: string, defaultValue?: any, clone = false): any {
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
	 * @param key - the key to be checked
	 */
	hasKey(key: string): boolean {
		return this.store[key] !== undefined
	}

	/**
	 * Attempt to load the database from disk
	 * @access protected
	 */
	protected loadSync(): void {
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

		this.#setSaveCycle()
	}

	/**
	 * Attempt to load the backup file from disk as a recovery
	 */
	protected loadBackupSync(): void {
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
	 */
	protected loadDefaults(): void {
		this.store = cloneDeep(this.defaults)
		this.isFirstRun = true
		this.save()
	}

	/**
	 * Save the database to file
	 * @param withBackup - can be set to `false` if the current file should not be moved to `FILE.bak`
	 */
	save(withBackup = true): void {
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
	 */
	saveImmediate(): void {
		if (this.dirty === true) {
			this.save()
		}
	}

	/**
	 * Register that there are changes in the database that need to be saved as soon as possible
	 */
	protected setDirty(): void {
		this.dirty = true
	}

	/**
	 * Save/update a key/value pair to the database
	 * @param key - the key to save under
	 * @param value - the object to save
	 * @access public
	 */
	setKey(key: number | string | string[], value: any): void {
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
	 */
	#setSaveCycle(): void {
		if (this.saveCycle) return

		this.saveCycle = setInterval(() => {
			// See if the database is dirty and needs to be saved
			if (Date.now() - this.lastsave > this.saveInterval && this.dirty) {
				this.save()
			}
		}, this.saveInterval)
	}
}
