const DataCache = require('./Cache')
const DataImportExport = require('./ImportExport')
const DataMetrics = require('./Metrics')
const DataUserConfig = require('./UserConfig')

class DataController {
	constructor(registry) {
		this.cache = new DataCache(registry)
		this.userconfig = new DataUserConfig(registry)
		this.importExport = new DataImportExport(registry)
		this.metrics = new DataMetrics(registry)
	}

	/**
	 * Setup a new socket client's events
	 * @param {SocketIO} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		this.userconfig.clientConnect(client)
		this.importExport.clientConnect(client)
	}
}

module.exports = DataController
