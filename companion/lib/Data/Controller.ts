import { DataCache } from './Cache.js'
import { DataUserConfig } from './UserConfig.js'
import type { AppInfo } from '../Registry.js'
import type { DataDatabase } from './Database.js'

export class DataController {
	readonly cache: DataCache
	readonly userconfig: DataUserConfig

	constructor(appInfo: AppInfo, db: DataDatabase) {
		this.cache = new DataCache(appInfo.configDir)
		this.userconfig = new DataUserConfig(db)
	}
}
