import ServiceApi from './Api.js'
import ServiceArtnet from './Artnet.js'
import ServiceElgatoPlugin from './ElgatoPlugin.js'
import ServiceEmberPlus from './EmberPlus.js'
import ServiceHttps from './Https.js'
import ServiceOscListener from './OscListener.js'
import ServiceOscSender from './OscSender.js'
import ServiceRosstalk from './Rosstalk.js'
import ServiceSatellite from './Satellite.js'
import ServiceTcp from './Tcp.js'
import ServiceUdp from './Udp.js'

/**
 * Class that manages all of the services.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
 * @copyright 2022 Bitfocus AS
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
class ServiceController {
	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		this.https = new ServiceHttps(registry, registry.ui.express, registry.io)
		this.oscSender = new ServiceOscSender(registry)
		this.oscListener = new ServiceOscListener(registry)
		this.api = new ServiceApi(registry)
		this.tcp = new ServiceTcp(registry, this.api)
		this.udp = new ServiceUdp(registry, this.api)
		this.emberplus = new ServiceEmberPlus(registry)
		this.artnet = new ServiceArtnet(registry)
		this.rosstalk = new ServiceRosstalk(registry)
		this.satellite = new ServiceSatellite(registry)
		this.elgatoPlugin = new ServiceElgatoPlugin(registry)
	}

	/**
	 * Update a key/value pair from the user config
	 * @param {string} key - the key that changed
	 * @param {(boolean|number|string)} value - the new value
	 * @access public
	 */
	updateUserConfig(key, value) {
		this.artnet.updateUserConfig(key, value)
		this.elgatoPlugin.updateUserConfig(key, value)
		this.emberplus.updateUserConfig(key, value)
		this.https.updateUserConfig(key, value)
		this.oscListener.updateUserConfig(key, value)
		this.oscSender.updateUserConfig(key, value)
		this.rosstalk.updateUserConfig(key, value)
		this.satellite.updateUserConfig(key, value)
		this.tcp.updateUserConfig(key, value)
		this.udp.updateUserConfig(key, value)
	}
}

export default ServiceController
