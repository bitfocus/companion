import fs from 'fs-extra'
import path from 'path'
import LogController, { type Logger } from '../../Log/Controller.js'

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
 */
export class DataLegacyStoreBase {
	protected readonly logger: Logger

	/**
	 * The full backup file path
	 */
	private readonly cfgBakFile: string = ''
	/**
	 * The config directory
	 */
	private readonly cfgDir: string = ''
	/**
	 * The full main file path
	 */
	private readonly cfgFile: string = ''
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
			out = structuredClone(this.store)
		} else {
			out = this.store
		}

		return out
	}

	/**
	 * Get a value from the database
	 * @param key - the key to be retrieved
	 * @param defaultValue - the default value to use if the key doesn't exist
	 * @param clone - <code>true</code> if a clone is needed instead of a link
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	getKey(key: string, defaultValue?: any, clone = false): any {
		let out
		this.logger.silly(`${this.name}_get(${key})`)

		if (this.store[key] === undefined && defaultValue !== undefined) {
			this.store[key] = defaultValue
		}

		if (clone === true) {
			out = structuredClone(this.store[key])
		} else {
			out = this.store[key]
		}

		return out
	}

	/**
	 * Attempt to load the database from disk
	 * @access protected
	 */
	protected loadSync(): void {
		if (fs.existsSync(this.cfgFile)) {
			this.logger.silly(this.cfgFile, 'exists. trying to read')

			try {
				const data = fs.readFileSync(this.cfgFile, 'utf8')

				if (data.trim().length > 0 || data.startsWith('\0')) {
					this.store = JSON.parse(data)
					this.logger.silly('parsed JSON')
				} else {
					this.logger.debug(`${this.name} was empty.  Attempting to recover the configuration.`)
					this.loadBackupSync()
				}
			} catch (_e) {
				this.logger.debug(`${this.name} could not be parsed.`)

				this.loadBackupSync()
			}
		} else {
			this.logger.debug(`${this.name} is missing.  Attempting to recover the configuration.`)
			this.loadBackupSync()
		}
	}

	/**
	 * Attempt to load the backup file from disk as a recovery
	 */
	protected loadBackupSync(): void {
		if (fs.existsSync(this.cfgBakFile)) {
			this.logger.silly(this.cfgBakFile, 'exists. trying to read')
			const data = fs.readFileSync(this.cfgBakFile, 'utf8')

			try {
				if (data.trim().length > 0 || data.startsWith('\0')) {
					this.store = JSON.parse(data)
					this.logger.silly('parsed JSON')
					this.logger.debug(`${this.name}.bak has been used to recover the configuration.`)
				} else {
					this.logger.debug(`${this.name}.bak was empty.`)
					throw new Error(`Could not load legacy ${this.name} file or backup.`)
				}
			} catch (_e) {
				this.logger.debug(`${this.name}.bak Could not load database backup file`)
				throw new Error(`Could not load legacy ${this.name} file or backup.`)
			}
		}
	}
}
