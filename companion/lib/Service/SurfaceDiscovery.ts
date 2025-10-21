import isEqual from 'fast-deep-equal'
import { ServiceBase } from './Base.js'
import { Bonjour, type Browser, type DiscoveredService } from '@julusian/bonjour-service'
import systeminformation from 'systeminformation'
import { StreamDeckTcpDefinition, StreamDeckTcpDiscoveryService } from '@elgato-stream-deck/tcp'
import type {
	ClientDiscoveredSurfaceInfo,
	CompanionExternalAddresses,
	SurfacesDiscoveryUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { DropdownChoice } from '@companion-module/base'
import type { DataUserConfig } from '../Data/UserConfig.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import EventEmitter from 'node:events'

/**
 * Class providing the discovery of Satellite Surface.
 *
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
 */
export class ServiceSurfaceDiscovery extends ServiceBase {
	#bonjour = new Bonjour()

	#satelliteBrowser: Browser | undefined
	#streamDeckDiscovery: StreamDeckTcpDiscoveryService | undefined

	#satelliteExpireInterval: NodeJS.Timeout | undefined

	#surfaceEvents = new EventEmitter<{ event: [info: SurfacesDiscoveryUpdate] }>()

	constructor(userconfig: DataUserConfig) {
		super(userconfig, 'Service/SurfaceDiscovery', 'discoveryEnabled', null)

		this.init()
	}

	listen(): void {
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
			} catch (_e) {
				this.logger.debug(`ERROR failed to start searching for companion satellite devices`)
			}
		}

		if (!this.#streamDeckDiscovery) {
			try {
				this.#streamDeckDiscovery = new StreamDeckTcpDiscoveryService()

				this.#streamDeckDiscovery.on('up', (streamdeck) => {
					const uiService = this.#convertStreamDeckForUi(streamdeck)
					if (!uiService) return

					this.logger.debug(
						`Found streamdeck tcp device ${streamdeck.name} at ${streamdeck.address}:${streamdeck.port}`
					)

					this.#surfaceEvents.emit('event', {
						type: 'update',
						info: uiService,
					})
				})
				this.#streamDeckDiscovery.on('down', (streamdeck) => {
					const uiService = this.#convertStreamDeckForUi(streamdeck)
					if (!uiService) return

					this.#surfaceEvents.emit('event', {
						type: 'remove',
						itemId: uiService.id,
					})
				})

				setImmediate(() => {
					this.#streamDeckDiscovery?.query()
				})
			} catch (_e) {
				this.logger.debug(`ERROR failed to start searching for streamdeck tcp devices`)
			}
		}
	}

	close(): void {
		this.#streamDeckDiscovery?.destroy()
		this.#streamDeckDiscovery = undefined
		this.#bonjour.destroy()
	}

	#updateSatelliteService(oldService: DiscoveredService | undefined, service: DiscoveredService) {
		this.logger.debug(`Found companion satellite device ${service.name} at ${service.addresses?.[0]}:${service.port}`)

		if (oldService) {
			const oldServiceInfo = this.#convertSatelliteServiceForUi(oldService)
			const newServiceInfo = this.#convertSatelliteServiceForUi(service)

			if (isEqual(oldServiceInfo, newServiceInfo)) {
				// Nothing to do
				return
			}
		}

		this.#surfaceEvents.emit('event', {
			type: 'update',
			info: this.#convertSatelliteServiceForUi(service),
		})
	}

	#forgetSatelliteService(service: DiscoveredService) {
		this.#surfaceEvents.emit('event', {
			type: 'remove',
			itemId: this.#convertSatelliteServiceForUi(service).id,
		})
	}

	#convertSatelliteServiceForUi(service: DiscoveredService): ClientDiscoveredSurfaceInfo {
		return {
			id: service.fqdn,

			surfaceType: 'satellite',

			name: service.name,
			addresses: service.addresses ?? [],
			port: service.port,

			apiEnabled: service.txt?.restEnabled === 'true',
		}
	}

	#convertStreamDeckForUi(streamdeck: StreamDeckTcpDefinition): ClientDiscoveredSurfaceInfo | null {
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
	protected disableModule(): void {
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
			} catch (e: any) {
				this.logger.silly(`Could not stop searching for satellite devices: ${e.message}`)
			}

			try {
				if (this.#streamDeckDiscovery) {
					this.#streamDeckDiscovery.destroy()
					this.#streamDeckDiscovery = undefined
				}

				this.logger.info(`Stopped searching for streamdeck tcp devices`)
			} catch (e: any) {
				this.logger.silly(`Could not stop searching for streamdeck tcp devices: ${e.message}`)
			}
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			externalAddresses: publicProcedure.query(async () => {
				return this.#getExternalAddresses()
			}),

			/**
			 * Returns a failure reason, or null if successful.
			 */
			setupSatellite: publicProcedure
				.input(
					z.object({
						satelliteInfo: z.object({
							// Snippet of ClientDiscoveredSurfaceInfoSatellite
							name: z.string().min(1, 'Satellite name is required'),
							addresses: z.array(z.string().min(1, 'Satellite address is required')),
							port: z
								.number()
								.int()
								.min(1, 'Port must be a positive integer')
								.max(65535, 'Port must be less than 65536'),
						}),
						companionAddress: z.string().min(1, 'Companion address is required'),
					})
				)
				.mutation(async ({ input }) => {
					// if (info.surfaceType !== 'satellite') return 'invalid surface type'

					// construct the remote url
					const url = new URL('http://localhost:9999/api/config')
					url.hostname = input.satelliteInfo.addresses[0] // TODO - choose correct address
					url.port = input.satelliteInfo.port.toString()

					this.logger.info(
						`Setting up satellite ${input.satelliteInfo.name} at ${url.toString()} to ${input.companionAddress}:${16622}`
					)

					try {
						await fetch(url, {
							method: 'POST',
							headers: {
								'Content-Type': 'application/json',
							},
							body: JSON.stringify({
								host: input.companionAddress,
								port: 16622, // TODO - dynamic
							}),
						})

						return null
					} catch (_e) {
						return 'request failed'
					}
				}),

			watchForSurfaces: publicProcedure.subscription<AsyncIterable<SurfacesDiscoveryUpdate>>(async function* (opts) {
				// Start the changes listener
				const changes = toIterable(self.#surfaceEvents, 'event', opts.signal)

				// Send the initial data
				const initialServices: ClientDiscoveredSurfaceInfo[] = []

				if (self.#satelliteBrowser) {
					for (const service of self.#satelliteBrowser.services) {
						const uiService = self.#convertSatelliteServiceForUi(service)
						initialServices.push(uiService)
					}
				}

				if (self.#streamDeckDiscovery) {
					for (const service of self.#streamDeckDiscovery.knownStreamDecks) {
						const uiService = self.#convertStreamDeckForUi(service)
						if (uiService) initialServices.push(uiService)
					}
				}

				yield {
					type: 'init',
					infos: initialServices,
				} satisfies SurfacesDiscoveryUpdate

				// Stream any changes
				for await (const [data] of changes) {
					yield data
				}
			}),
		})
	}

	async #getExternalAddresses(): Promise<CompanionExternalAddresses> {
		const rawInterfacesList = await systeminformation.networkInterfaces()

		const addresses: DropdownChoice[] = []

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
		} catch (_e) {
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
	}
}
