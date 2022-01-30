exports = module.exports = function (system, io) {
	return new Service(system, io)
}

class Service {
	constructor(system, io) {
		this.server_https = require('./Https')(system, io.server_express, io.io)
		this.osc = require('./Osc')(system)
		this.server_api = require('./Api')(system)
		this.server_tcp = require('./Tcp')(system)
		this.server_udp = require('./Udp')(system)
		this.server_emberplus = require('./EmberPlus')(system)
		this.artnet = require('./Artnet')(system)
		this.rosstalk = require('./Rosstalk')(system)
		this.rest = require('./Rest')(system)
		this.rest_poll = require('./RestPoll')(system)
		this.satellite = require('./Satellite')(system)
		this.elgato_plugin_server = require('./ElgatoPlugin')(system)
	}
}
