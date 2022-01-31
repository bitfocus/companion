const ServiceApi = require('./Api')
const ServiceArtnet = require('./Artnet')
const ServiceElgatoPlugin = require('./ElgatoPlugin')
const ServiceEmberPlus = require('./EmberPlus')
const ServiceHttps = require('./Https')
const ServiceOsc = require('./Osc')
const ServiceRest = require('./Rest')
const ServiceRestPoll = require('./RestPoll')
const ServiceRosstalk = require('./Rosstalk')
const ServiceSatellite = require('./Satellite')
const ServiceTcp = require('./Tcp')
const ServiceUdp = require('./Udp')

class ServiceController {
	constructor(registry, ui) {
		this.server_https = new ServiceHttps(registry, registry.ui.server_express, registry.io)
		this.osc = new ServiceOsc(registry)
		this.server_api = new ServiceApi(registry)
		this.server_tcp = new ServiceTcp(registry)
		this.server_udp = new ServiceUdp(registry)
		this.server_emberplus = new ServiceEmberPlus(registry)
		this.artnet = new ServiceArtnet(registry)
		this.rosstalk = new ServiceRosstalk(registry)
		this.rest = new ServiceRest(registry)
		this.rest_poll = new ServiceRestPoll(registry)
		this.satellite = new ServiceSatellite(registry)
		this.elgato_plugin_server = new ServiceElgatoPlugin(registry)
	}
}

module.exports = ServiceController
