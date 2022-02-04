const ServiceApi = require('./Api')
const ServiceArtnet = require('./Artnet')
const ServiceElgatoPlugin = require('./ElgatoPlugin')
const ServiceEmberPlus = require('./EmberPlus')
const ServiceHttps = require('./Https')
const ServiceOsc = require('./Osc')
const ServiceRest = require('./Rest')
const ServiceRosstalk = require('./Rosstalk')
const ServiceSatellite = require('./Satellite')
const ServiceTcp = require('./Tcp')
const ServiceUdp = require('./Udp')

class ServiceController {
	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		this.https = new ServiceHttps(registry, registry.ui.express, registry.io)
		this.osc = new ServiceOsc(registry)
		this.api = new ServiceApi(registry)
		this.tcp = new ServiceTcp(registry)
		this.udp = new ServiceUdp(registry)
		this.emberplus = new ServiceEmberPlus(registry)
		this.artnet = new ServiceArtnet(registry)
		this.rosstalk = new ServiceRosstalk(registry)
		this.rest = new ServiceRest(registry)
		this.satellite = new ServiceSatellite(registry)
		this.elgato_plugin = new ServiceElgatoPlugin(registry)
	}

	/**
	 * Update a key/value pair from the user config
	 * @param {string} key - the key that changed
	 * @param {(boolean|number|string)} value - the new value
	 * @access public
	 */
	updateUserconfig(key, value) {
		this.artnet.updateUserconfig(key, value)
		this.elgato_plugin.updateUserconfig(key, value)
		this.emberplus.updateUserconfig(key, value)
		this.https.updateUserconfig(key, value)
		this.osc.updateUserconfig(key, value)
		this.rosstalk.updateUserconfig(key, value)
		this.satellite.updateUserconfig(key, value)
		this.tcp.updateUserconfig(key, value)
		this.udp.updateUserconfig(key, value)
	}
}

module.exports = ServiceController
