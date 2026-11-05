import EventEmitter from 'node:events'
import { Bonjour, type Browser, type DiscoveredService } from '@julusian/bonjour-service'
import isEqual from 'fast-deep-equal'
import systeminformation from 'systeminformation'
import z from 'zod'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type {
	ClientDiscoveredSurfaceInfo,
	ClientDiscoveredSurfaceInfoPlugin,
	CompanionExternalAddresses,
	SurfacesDiscoveryUpdate,
} from '@companion-app/shared/Model/Surfaces.js'
import type { DiscoveredRemoteSurfaceInfo } from '@companion-surface/host'
import LogController from '../Log/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'

const SATELLITE_MDNS_SERVICE_TYPE = 'comp-sat-app'
const LEGACY_SATELLITE_MDNS_SERVICE_TYPE = 'companion-satellite'

/**
 * The satellite services to show, leaving out those announced under the legacy type when they are also announced
 * under the current one
 */
export function getSatelliteServices(
	services: DiscoveredService[],
	legacyServices: DiscoveredService[]
): DiscoveredService[] {
	const names = new Set(services.map((service) => service.name))
	return [...services, ...legacyServices.filter((service) => !names.has(service.name))]
}

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
export class ServiceSurfaceDiscovery {
	readonly #logger = LogController.createLogger('Surface/Discovery')
	readonly #bonjour = new Bonjour()

	#satelliteBrowser: Browser | undefined
	/** Browses the pre-5.2 type, which is longer than RFC 6763 allows. TODO: remove in 6.0 */
	#legacySatelliteBrowser: Browser | undefined
	/** The satellite services last sent to the ui, by id */
	#satelliteServices = new Map<string, ClientDiscoveredSurfaceInfo>()

	#satelliteExpireInterval: NodeJS.Timeout | undefined

	#surfaceEvents = new EventEmitter<{ event: [info: SurfacesDiscoveryUpdate] }>()

	#knownSurfaces = new Map<string, Map<string, DiscoveredRemoteSurfaceInfo>>()

	constructor() {
		try {
			this.#satelliteBrowser = this.#watchSatelliteType(SATELLITE_MDNS_SERVICE_TYPE)
			this.#legacySatelliteBrowser = this.#watchSatelliteType(LEGACY_SATELLITE_MDNS_SERVICE_TYPE)

			this.#satelliteExpireInterval = setInterval(() => {
				this.#satelliteBrowser?.expire()
				this.#legacySatelliteBrowser?.expire()
			}, 30000)
		} catch (_e) {
			this.#logger.debug(`ERROR failed to start searching for companion satellite devices`)
		}
	}

	quit(): void {
		this.#bonjour.destroy()

		if (this.#satelliteExpireInterval) clearInterval(this.#satelliteExpireInterval)
	}

	instanceForget(instanceId: string): void {
		const connectionsToForget = this.#knownSurfaces.get(instanceId)
		this.#knownSurfaces.delete(instanceId)

		if (!connectionsToForget) return

		for (const info of connectionsToForget.values()) {
			this.#surfaceEvents.emit('event', {
				type: 'remove',
				itemId: convertPluginConnectionToUi(instanceId, info).id,
			})
		}
	}
	instanceConnectionsFound(instanceId: string, connectionInfos: DiscoveredRemoteSurfaceInfo[]): void {
		const connections = this.#knownSurfaces.get(instanceId) ?? new Map<string, DiscoveredRemoteSurfaceInfo>()
		this.#knownSurfaces.set(instanceId, connections)

		for (const info of connectionInfos) {
			const oldInfo = connections.get(info.id)

			// TODO - ignore config in the diff
			if (!oldInfo || !isEqual(oldInfo, info)) {
				connections.set(info.id, info)

				this.#surfaceEvents.emit('event', {
					type: 'update',
					info: convertPluginConnectionToUi(instanceId, info),
				})
			}
		}
	}
	instanceConnectionsForgotten(instanceId: string, connectionInfos: string[]): void {
		const connections = this.#knownSurfaces.get(instanceId) ?? new Map()
		this.#knownSurfaces.set(instanceId, connections)

		for (const infoId of connectionInfos) {
			if (connections.has(infoId)) {
				connections.delete(infoId)

				this.#surfaceEvents.emit('event', {
					type: 'remove',
					itemId: `${instanceId}:${infoId}`,
				})
			}
		}
	}

	#watchSatelliteType(type: string): Browser {
		const browser = this.#bonjour.find({ type, protocol: 'tcp' })
		browser.on('up', (service) => {
			this.#logger.debug(
				`Found companion satellite device ${service.name} at ${service.addresses?.[0]}:${service.port}`
			)
			this.#updateSatelliteServices()
		})
		browser.on('down', () => this.#updateSatelliteServices())
		browser.on('txt-update', () => this.#updateSatelliteServices())
		browser.on('srv-update', () => this.#updateSatelliteServices())
		return browser
	}

	/** Send the ui what changed in the satellite services, after any of them changes */
	#updateSatelliteServices() {
		const services = getSatelliteServices(
			this.#satelliteBrowser?.services ?? [],
			this.#legacySatelliteBrowser?.services ?? []
		)

		const newServices = new Map<string, ClientDiscoveredSurfaceInfo>()
		for (const service of services) {
			const info = this.#convertSatelliteServiceForUi(service)
			newServices.set(info.id, info)

			if (!isEqual(this.#satelliteServices.get(info.id), info)) {
				this.#surfaceEvents.emit('event', { type: 'update', info })
			}
		}
		for (const id of this.#satelliteServices.keys()) {
			if (!newServices.has(id)) this.#surfaceEvents.emit('event', { type: 'remove', itemId: id })
		}

		this.#satelliteServices = newServices
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

	getInfoForConnectionId(instanceId: string, connectionId: string): DiscoveredRemoteSurfaceInfo | undefined {
		const connections = this.#knownSurfaces.get(instanceId)
		if (!connections) return undefined

		for (const connectionInfo of connections.values()) {
			const fullId = `${instanceId}:${connectionInfo.id}`
			if (fullId === connectionId) {
				return connectionInfo
			}
		}

		return undefined
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

					this.#logger.info(
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

				initialServices.push(...self.#satelliteServices.values())

				for (const [instanceId, knownSurfaces] of self.#knownSurfaces) {
					for (const surface of knownSurfaces.values()) {
						initialServices.push(convertPluginConnectionToUi(instanceId, surface))
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

function convertPluginConnectionToUi(
	instanceId: string,
	info: DiscoveredRemoteSurfaceInfo
): ClientDiscoveredSurfaceInfoPlugin {
	return {
		id: `${instanceId}:${info.id}`,
		surfaceType: 'plugin',
		instanceId: instanceId,
		name: info.displayName,
		description: info.description,
		address: info.addresses,
		config: info.config,
	}
}
