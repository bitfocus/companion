const DataImportExport = require('./ImportExport')
const DataMetrics = require('./Metrics')
const DataUserConfig = require('./UserConfig')

class DataController {
	constructor(registry) {
		this.userconfig = new DataUserConfig(registry)
		this.importExport = new DataImportExport(registry)
		this.metrics = new DataMetrics(registry)
	}
}

module.exports = DataController
