import type { AppInfo } from '../Registry.js'
import { DataCache } from './Cache.js'
import type { DataDatabase } from './Database.js'
import type { OperationObserver } from './StoreBase.js'
import { DataUserConfig } from './UserConfig.js'

export class DataController {
	readonly cache: DataCache
	readonly userconfig: DataUserConfig

	constructor(appInfo: AppInfo, db: DataDatabase, cacheOperationObserver: OperationObserver) {
		this.cache = new DataCache(appInfo.configDir, cacheOperationObserver)
		this.userconfig = new DataUserConfig(appInfo, db)
	}
}
