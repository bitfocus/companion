import { DataCache } from './Cache.js'
import { DataImportExport } from './ImportExport.js'
import { DataUserConfig } from './UserConfig.js'
import type { Registry } from '../Registry.js'
import type { ClientSocket } from '../UI/Handler.js'

export class DataController {
	readonly cache: DataCache
	readonly userconfig: DataUserConfig
	readonly importExport: DataImportExport

	constructor(registry: Registry) {
		this.cache = new DataCache(registry.appInfo.configDir)
		this.userconfig = new DataUserConfig(registry)
		this.importExport = new DataImportExport(registry)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.userconfig.clientConnect(client)
		this.importExport.clientConnect(client)
	}
}
