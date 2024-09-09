import { isEqual } from 'lodash-es'
import ServiceBase from './Base.js'
import { Bonjour, Browser } from '@julusian/bonjour-service'
import systeminformation from 'systeminformation'
import got from 'got'
import { StreamDeckTcpDiscoveryService } from '@elgato-stream-deck/tcp'

const SurfaceDiscoveryRoom = 'surfaces:discovery'

/**
 * Class providing the discovery of Satellite Surface.
 *
 * @extends ServiceBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.4.0
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
	 * @type {StreamDeckTcpDiscoveryService | undefined}
	 */
	#streamDeckDiscovery

	/**
	 * @type {NodeJS.Timeout | undefined}
	 */
	#satelliteExpireInterval

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'Service/SurfaceDiscovery', 'discoveryEnabled', null)

		this.init()
	}

	listen() {
		this.currentState = true

		if (!this.#satelliteBrowser) {
			try {
				this.#satelliteBrowser = this.#bonjour.find({ type: 'companion-satellite', protocol: 'tcp' })

				this.#satelliteExpireInterval = setInterval(() => {
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

		if (!this.#streamDeckDiscovery) {
			try {
				this.#streamDeckDiscovery = new StreamDeckTcpDiscoveryService()

				// @ts-ignore why is this failing?
				this.#streamDeckDiscovery.on('up', (streamdeck) => {
					const uiService = this.#convertStreamDeckForUi(streamdeck)
					if (!uiService) return

					this.logger.debug(
						`Found streamdeck tcp device ${streamdeck.name} at ${streamdeck.address}:${streamdeck.port}`
					)

					this.io.emitToRoom(SurfaceDiscoveryRoom, 'surfaces:discovery:update', {
						type: 'update',
						info: uiService,
					})
				})
				// @ts-ignore why is this failing?
				this.#streamDeckDiscovery.on('down', (streamdeck) => {
					const uiService = this.#convertStreamDeckForUi(streamdeck)
					if (!uiService) return

					this.io.emitToRoom(SurfaceDiscoveryRoom, 'surfaces:discovery:update', {
						type: 'remove',
						itemId: uiService.id,
					})
				})

				setImmediate(() => {
					this.#streamDeckDiscovery?.query()
				})
			} catch (e) {
				this.logger.debug(`ERROR failed to start searching for streamdeck tcp devices`)
			}
		}
	}

	/**
	 *
	 * @param {import('@julusian/bonjour-service').Service | undefined} oldService
	 * @param {import('@julusian/bonjour-service').Service} service
	 */
	#updateSatelliteService(oldService, service) {
		this.logger.debug(`Found companion satellite device ${service.name} at ${service.addresses?.[0]}:${service.port}`)

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
	 *
	 * @param {import('@elgato-stream-deck/tcp').StreamDeckTcpDefinition} streamdeck
	 * @returns {import('@companion-app/shared/Model/Surfaces.js').ClientDiscoveredSurfaceInfo | null}
	 */
	#convertStreamDeckForUi(streamdeck) {
		if (!streamdeck.isPrimary) return null

		return {
			id: `streamdeck:${streamdeck.serialNumber ?? streamdeck.name}`,

			surfaceType: 'streamdeck',

			name: streamdeck.name,
			address: streamdeck.address,
			port: streamdeck.port,

			modelName: streamdeck.modelName,
			serialnumber: streamdeck.serialNumber,
		}
	}

	/**
	 * Kill the socket, if exists.
	 * @access protected
	 * @override
	 */
	disableModule() {
		if (this.currentState) {
			this.currentState = false
			try {
				if (this.#satelliteBrowser) {
					for (const service of this.#satelliteBrowser.services) {
						this.#forgetSatelliteService(service)
					}
					this.#satelliteBrowser.stop()
					this.#satelliteBrowser = undefined
				}

				clearTimeout(this.#satelliteExpireInterval)
				this.#satelliteExpireInterval = undefined

				this.logger.info(`Stopped searching for satellite devices`)
			} catch (/** @type {any} */ e) {
				this.logger.silly(`Could not stop searching for satellite devices: ${e.message}`)
			}

			try {
				if (this.#streamDeckDiscovery) {
					this.#streamDeckDiscovery.destroy()
					this.#streamDeckDiscovery = undefined
				}

				this.logger.info(`Stopped searching for streamdeck tcp devices`)
			} catch (/** @type {any} */ e) {
				this.logger.silly(`Could not stop searching for streamdeck tcp devices: ${e.message}`)
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

			if (this.#streamDeckDiscovery) {
				for (const service of this.#streamDeckDiscovery.knownStreamDecks) {
					const uiService = this.#convertStreamDeckForUi(service)
					if (uiService) services[uiService.id] = uiService
				}
			}

			return services
		})
		client.onPromise('surfaces:discovery:leave', () => {
			client.leave(SurfaceDiscoveryRoom)
		})

		client.onPromise('surfaces:discovery:get-external:addresses', async () => {
			const rawInterfacesList = await systeminformation.networkInterfaces()

			/** @type {import('@companion-module/base').DropdownChoice[]} */
			const addresses = []

			try {
				const systemInfo = await systeminformation.osInfo()

				addresses.push({
					id: systemInfo.fqdn,
					label: systemInfo.fqdn,
				})

				if (systemInfo.fqdn !== systemInfo.hostname) {
					addresses.push({
						id: systemInfo.hostname,
						label: systemInfo.hostname,
					})
				}
			} catch (e) {
				// TODO
			}

			if (Array.isArray(rawInterfacesList)) {
				for (const obj of rawInterfacesList) {
					if (obj.ip4 && !obj.internal) {
						let label = `${obj.iface}: ${obj.ip4}`
						if (obj.type && obj.type !== 'unknown') label += ` (${obj.type})`

						addresses.push({
							id: obj.ip4,
							label: label,
						})
					}
				}
			}

			return {
				addresses,
			}
		})

		client.onPromise('surfaces:discovery:setup-satellite', async (info, address) => {
			if (info.surfaceType !== 'satellite') return 'invalid surface type'

			// construct the remote url
			const url = new URL('http://localhost:9999/api/config')
			url.hostname = info.addresses[0] // TODO - choose correct address
			url.port = info.port.toString()

			this.logger.info(`Setting up satellite ${info.name} at ${url.toString()} to ${address}:${16622}`)

			try {
				await got(url, {
					method: 'POST',
					json: {
						host: address,
						port: 16622, // TODO - dynamic
					},
				})

				return null
			} catch (e) {
				return 'request failed'
			}
		})
	}
}

/**
 * @typedef {{
 *   id: string
 * }} SatelliteServiceInfo
 */
