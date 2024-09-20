import fs from 'fs-extra'
import path from 'path'
import { cloneDeep } from 'lodash-es'
import LogController, { Logger } from '../../Log/Controller.js'
import { showErrorMessage } from '../../Resources/Util.js'

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
export class DataLegacyStoreBase {
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
	 * The stored defaults for a new store
	 */
	private readonly defaults: object = {}
	/**
	 * The name to use for the file and logging
	 */
	private readonly name: string = ''

	/**
	 * The flat file DB in RAM
	 */
	store: Record<string, any> = {}

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, name, debug)</code>.
	 * @param configDir - the root config directory
	 * @param name - the name of the flat file
	 * @param debug - module path to be used in the debugger
	 */
	constructor(configDir: string, name: string, debug: string) {
		this.logger = LogController.createLogger(debug)

		this.cfgDir = configDir
		this.name = name

		this.cfgFile = path.join(this.cfgDir, this.name)
		this.cfgBakFile = path.join(this.cfgDir, this.name + '.bak')
		this.cfgCorruptFile = path.join(this.cfgDir, this.name + '.corrupt')
	}

	/**
	 * Delete a key/value pair
	 * @param key - the key to be delete
	 */
	deleteKey(key: string): void {
		this.logger.silly(`${this.name}_del (${key})`)
		if (key !== undefined) {
			delete this.store[key]
		}
	}

	/**
	 * Get the entire database
	 * @param clone - <code>true</code> if a clone is needed instead of a link
	 * @returns the database
	 */
	getAll(clone = false): any {
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
		}
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
				} else {
					this.logger.warn(`${this.name} was empty.  Creating a new db.`)
				}
			} catch (e) {
				showErrorMessage('Error starting companion', 'Could not load database backup  file. Resetting configuration')

				console.error('Could not load database backup file')
			}
		} else {
			showErrorMessage('Error starting companion', 'Could not load database backup  file. Resetting configuration')

			console.error('Could not load database file')
		}
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
				}
			} else {
				this.store[key] = value
			}
		}
	}
}
