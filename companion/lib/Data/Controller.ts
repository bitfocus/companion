import type { AppInfo } from '../Registry.js'
import { DataCache } from './Cache.js'
import type { DataDatabase } from './Database.js'
import { DataUserConfig } from './UserConfig.js'

export class DataController {
	readonly cache: DataCache
	readonly userconfig: DataUserConfig

	constructor(appInfo: AppInfo, db: DataDatabase) {
		this.cache = new DataCache(appInfo.configDir)
		this.userconfig = new DataUserConfig(db)
	}
}
