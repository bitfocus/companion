import { isEqual } from 'lodash-es'
import ServiceBase from './Base.js'
import { Bonjour, Browser } from '@julusian/bonjour-service'

const SurfaceDiscoveryRoom = 'surfaces:discovery'

/**
 * Class providing the discovery of Satellite Surface.
 *
 * @extends ServiceBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.2.0
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
export class ServiceSurfaceDiscovery extends ServiceBase {
	#bonjour = new Bonjour()

	/**
	 * @type {Browser | undefined}
	 */
	#satelliteBrowser

	/**
	 * @type {NodeJS.Timeout | undefined}
	 */
	#satelliteQueryPoll

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'Service/Satellite', 'discoveryEnabled', null)

		this.init()
	}

	listen() {
		if (!this.#satelliteBrowser) {
			try {
				this.#satelliteBrowser = this.#bonjour.find({ type: 'companion-satellite', protocol: 'tcp' })

				this.#satelliteQueryPoll = setInterval(() => {
					this.#satelliteBrowser?.update()
					this.#satelliteBrowser?.expire()
				}, 30000)

				this.#satelliteBrowser.on('up', (service) => {
					this.#updateSatelliteService(undefined, service)
				})
				this.#satelliteBrowser.on('down', (service) => {
					this.#forgetSatelliteService(service)
				})
				this.#satelliteBrowser.on('txt-update', (newService, oldService) => {
					this.#updateSatelliteService(oldService, newService)
				})
				this.#satelliteBrowser.on('srv-update', (newService, oldService) => {
					this.#updateSatelliteService(oldService, newService)
				})
			} catch (e) {
				this.logger.debug(`ERROR failed to start searching for companion satellite devices`)
			}
		}
	}

	/**
	 *
	 * @param {import('@julusian/bonjour-service').Service | undefined} oldService
	 * @param {import('@julusian/bonjour-service').Service} service
	 */
	#updateSatelliteService(oldService, service) {
		if (oldService) {
			const oldServiceInfo = this.#convertSatelliteServiceForUi(oldService)
			const newServiceInfo = this.#convertSatelliteServiceForUi(service)

			if (isEqual(oldServiceInfo, newServiceInfo)) {
				// Nothing to do
				return
			}
		}

		this.io.emitToRoom(SurfaceDiscoveryRoom, 'surfaces:discovery:update', {
			type: 'update',
			info: this.#convertSatelliteServiceForUi(service),
		})
	}

	/**
	 *
	 * @param {import('@julusian/bonjour-service').Service} service
	 */
	#forgetSatelliteService(service) {
		this.io.emitToRoom(SurfaceDiscoveryRoom, 'surfaces:discovery:update', {
			type: 'remove',
			itemId: this.#convertSatelliteServiceForUi(service).id,
		})
	}

	/**
	 *
	 * @param {import('@julusian/bonjour-service').Service} service
	 * @returns {import('@companion-app/shared/Model/Surfaces.js').ClientDiscoveredSurfaceInfo}
	 */
	#convertSatelliteServiceForUi(service) {
		return {
			id: service.fqdn,

			surfaceType: 'satellite',

			name: service.name,
			addresses: service.addresses ?? [],
			port: service.port,

			apiEnabled: service.txt?.restEnabled === 'true',
		}
	}

	/**
	 * Kill the socket, if exists.
	 * @access protected
	 * @override
	 */
	disableModule() {
		if (this.#satelliteBrowser) {
			try {
				this.currentState = false
				this.#satelliteBrowser.stop()
				clearTimeout(this.#satelliteQueryPoll)
				this.logger.info(`Stopped searching for satellite devices`)
				this.#satelliteBrowser = undefined
				this.#satelliteQueryPoll = undefined
			} catch (/** @type {any} */ e) {
				this.logger.silly(`Could not stop searching for satellite devices: ${e.message}`)
			}
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
		client.onPromise('surfaces:discovery:join', () => {
			client.join(SurfaceDiscoveryRoom)

			/** @type {Record<string, import('@companion-app/shared/Model/Surfaces.js').ClientDiscoveredSurfaceInfo>} */
			const services = {}

			if (this.#satelliteBrowser) {
				for (const service of this.#satelliteBrowser.services) {
					const uiService = this.#convertSatelliteServiceForUi(service)
					services[uiService.id] = uiService
				}
			}

			return services
		})
		client.onPromise('surfaces:discovery:leave', () => {
			client.leave(SurfaceDiscoveryRoom)
		})
	}
}

/**
 * @typedef {{
 *   id: string
 * }} SatelliteServiceInfo
 */
