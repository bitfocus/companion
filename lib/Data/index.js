exports = module.exports = function (system, db) {
	return new Data(system, db)
}

class Data {
	constructor(system, db) {
		require('./Upgrade').startup(db)
		this.userconfig = require('./UserConfig')(system)
		this.loadsave = require('./ImportExport')(system)
		this.metrics = require('./Metrics')(system)
	}
}
