import LogController from '../Log/Controller.js'
import path from 'path'
import fs from 'fs-extra'
import type { InstanceModules } from './Modules.js'
import type { AppInfo } from '../Registry.js'
import type { ClientSocket } from '../UI/Handler.js'
import { DataDatabase } from '../Data/Database.js'
import type { UserModuleEntry } from '@companion-app/shared/Model/UserModules.js'

export class InstanceUserModulesManager {
	readonly #logger = LogController.createLogger('Instance/UserModulesManager')

	/**
	 */
	readonly #db: DataDatabase

	/**
	 */
	readonly #modulesManager: InstanceModules

	/**
	 * Absolute path for storing user modules on disk
	 */
	readonly #userModulesDir: string

	/**
	 */
	#store: UserModuleEntry[]

	/**
	 * The directory user loaded modules will be stored in
	 */
	get userModulesDir(): string {
		return this.#userModulesDir
	}

	constructor(modulesManager: InstanceModules, db: DataDatabase, appInfo: AppInfo) {
		this.#modulesManager = modulesManager
		this.#db = db
		this.#userModulesDir = path.join(appInfo.configDir, 'user-modules')

		this.#store = db.getKey('user-modules', [])
	}

	/**
	 * Initialise the user modules manager
	 */
	async init() {
		await fs.mkdirp(this.#userModulesDir)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(_client: ClientSocket): void {
		// TODO
	}
}
