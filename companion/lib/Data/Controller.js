import DataCache from './Cache.js'
import DataImportExport from './ImportExport.js'
import DataMetrics from './Metrics.js'
import DataUserConfig from './UserConfig.js'

class DataController {
	/**
	 * @param {import('../Registry.js').default} registry
	 */
	constructor(registry) {
		this.cache = new DataCache(registry.appInfo.configDir)
		this.userconfig = new DataUserConfig(registry)
		this.importExport = new DataImportExport(registry)
		this.metrics = new DataMetrics(registry)
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.userconfig.clientConnect(client)
		this.importExport.clientConnect(client)
	}
}

export default DataController
