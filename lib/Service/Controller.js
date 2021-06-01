const CoreBase = require('../Core/Base')
const ServiceApi = require('./Api')
const ServiceArtnet = require('./Artnet')
const ServiceEmberPlus = require('./EmberPlus')
const ServiceOsc = require('./Osc')
const ServiceRestLegacy = require('./RestLegacy')
const ServiceRosstalk = require('./Rosstalk')
const ServiceSatellite = require('./Satellite')
const ServiceTcp = require('./Tcp')
const ServiceUdp = require('./Udp')
const ServiceWebSockets = require('./WebSockets')

/**
 * Controller that launches and manages the various services
 *
 * @extends CoreBase
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @since 2.3.0
 * @copyright 2021 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class ServiceController extends CoreBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Service/Controller')

	/**
	 * @param {Registry} registry - the core registry
	 */
	constructor(registry) {
		super(registry, 'services')
		this.debug('launching service controller')

		this.osc = new ServiceOsc(this.registry)
		this.api = new ServiceApi(this.registry)
		this.tcp = new ServiceTcp(this.registry, this.api)
		this.udp = new ServiceUdp(this.registry, this.api)
		this.emberplus = new ServiceEmberPlus(this.registry)
		this.artnet = new ServiceArtnet(this.registry)
		this.rosstalk = new ServiceRosstalk(this.registry)
		this.satellite = new ServiceSatellite(this.registry)
		this.websockets = new ServiceWebSockets(this.registry)
		this.rest = new ServiceRestLegacy(this.registry)
	}

	/**
	 * Update a key/value pair from the user config
	 * @param {string} key - the key that changed
	 * @param {(boolean|number|string)} value - the new value
	 * @access public
	 */
	updateUserconfig(key, value) {
		this.artnet.updateUserconfig(key, value)
		this.osc.updateUserconfig(key, value)
		this.rosstalk.updateUserconfig(key, value)
		this.satellite.updateUserconfig(key, value)
		this.tcp.updateUserconfig(key, value)
		this.udp.updateUserconfig(key, value)
	}
}

exports = module.exports = ServiceController
