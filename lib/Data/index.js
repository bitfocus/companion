class Data {
	constructor(system) {
		this.userconfig = require('./UserConfig')(system)
		this.loadsave = require('./ImportExport')(system)
		this.metrics = require('./Metrics')(system)
	}
}

module.exports = Data
