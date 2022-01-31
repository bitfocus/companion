class Interface {
	constructor(system) {
		this.server_express = require('./Express')(system)
		this.server_http = require('./Server')(system, this.server_express)
		this.io = require('./Handler')(system, this.server_http)
		this.log = require('./Log')(system, this.io)
		this.update = require('./Update')(system)
		this.help = require('./Help')(system)
	}
}

module.exports = Interface
