import { ServiceArtnet } from './Artnet.js'
import { ServiceBonjourDiscovery } from './BonjourDiscovery.js'
import { ServiceElgatoPlugin } from './ElgatoPlugin.js'
import { ServiceEmberPlus } from './EmberPlus.js'
import { ServiceHttpApi } from './HttpApi.js'
import { ServiceHttps } from './Https.js'
import { ServiceOscListener } from './OscListener.js'
import { ServiceOscSender } from './OscSender.js'
import { ServiceRosstalk } from './Rosstalk.js'
import { ServiceSatelliteTcp } from './SatelliteTcp.js'
import { ServiceSurfaceDiscovery } from './SurfaceDiscovery.js'
import { ServiceTcp } from './Tcp.js'
import { ServiceUdp } from './Udp.js'
import { ServiceVideohubPanel } from './VideohubPanel.js'
import type { Registry } from '../Registry.js'
import type { ClientSocket } from '../UI/Handler.js'
import { ServiceSatelliteWebsocket } from './SatelliteWebsocket.js'
import type { EventEmitter } from 'events'
import type { ControlCommonEvents } from '../Controls/ControlDependencies.js'

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
export class ServiceController {
	readonly httpApi: ServiceHttpApi
	readonly https: ServiceHttps
	readonly oscSender: ServiceOscSender
	readonly oscListener: ServiceOscListener
	readonly tcp: ServiceTcp
	readonly udp: ServiceUdp
	readonly emberplus: ServiceEmberPlus
	readonly artnet: ServiceArtnet
	readonly rosstalk: ServiceRosstalk
	readonly satelliteTcp: ServiceSatelliteTcp
	readonly satelliteWebsocket: ServiceSatelliteWebsocket
	readonly elgatoPlugin: ServiceElgatoPlugin
	readonly videohubPanel: ServiceVideohubPanel
	readonly bonjourDiscovery: ServiceBonjourDiscovery
	readonly surfaceDiscovery: ServiceSurfaceDiscovery

	constructor(registry: Registry, oscSender: ServiceOscSender, controlEvents: EventEmitter<ControlCommonEvents>) {
		this.httpApi = new ServiceHttpApi(
			registry.userconfig,
			registry.page,
			registry.controls,
			registry.surfaces,
			registry.variables,
			registry.ui.express
		)
		this.https = new ServiceHttps(registry, registry.ui.express)
		this.oscSender = oscSender
		this.oscListener = new ServiceOscListener(registry)
		this.tcp = new ServiceTcp(registry)
		this.udp = new ServiceUdp(registry)
		this.emberplus = new ServiceEmberPlus(registry)
		this.artnet = new ServiceArtnet(registry)
		this.rosstalk = new ServiceRosstalk(registry)
		this.satelliteTcp = new ServiceSatelliteTcp(registry)
		this.satelliteWebsocket = new ServiceSatelliteWebsocket(registry)
		this.elgatoPlugin = new ServiceElgatoPlugin(registry)
		this.videohubPanel = new ServiceVideohubPanel(registry)
		this.bonjourDiscovery = new ServiceBonjourDiscovery(registry)
		this.surfaceDiscovery = new ServiceSurfaceDiscovery(registry)

		controlEvents.on('updateButtonState', (location, pushed, surfaceId) => {
			this.emberplus.updateButtonState(location, pushed, surfaceId)
		})
	}

	/**
	 * Update a key/value pair from the user config
	 * @param key - the key that changed
	 * @param value - the new value
	 */
	updateUserConfig(key: string, value: boolean | number | string): void {
		this.artnet.updateUserConfig(key, value)
		this.bonjourDiscovery.updateUserConfig(key, value)
		this.elgatoPlugin.updateUserConfig(key, value)
		this.emberplus.updateUserConfig(key, value)
		this.https.updateUserConfig(key, value)
		this.oscListener.updateUserConfig(key, value)
		this.oscSender.updateUserConfig(key, value)
		this.rosstalk.updateUserConfig(key, value)
		this.satelliteTcp.updateUserConfig(key, value)
		this.satelliteWebsocket.updateUserConfig(key, value)
		this.tcp.updateUserConfig(key, value)
		this.udp.updateUserConfig(key, value)
		this.videohubPanel.updateUserConfig(key, value)
		this.surfaceDiscovery.updateUserConfig(key, value)
	}

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		this.bonjourDiscovery.clientConnect(client)
		this.surfaceDiscovery.clientConnect(client)
	}
}
