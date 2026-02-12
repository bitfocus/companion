import { ServiceBase } from './Base.js'
import { Bonjour, type DiscoveredService, type Browser } from '@julusian/bonjour-service'
import { isIPv4, isIPv6 } from 'net'
import type { ClientBonjourEvent, ClientBonjourService } from '@companion-app/shared/Model/Common.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { InstanceController } from '../Instance/Controller.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import z from 'zod'
import EventEmitter from 'events'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { assertNever } from '@companion-app/shared/Util.js'

/**
 * Class providing Bonjour discovery for modules.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 3.1.0
 * @copyright 2023 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ServiceBonjourDiscovery extends ServiceBase {
	readonly #instanceController: InstanceController

	readonly #serviceEvents = new EventEmitter<{ [id: string]: [ClientBonjourEvent] }>()

	/**
	 * Active browsers running
	 */
	#browsers = new Map<string, BonjourBrowserSession>()

	#server: Bonjour | undefined

	constructor(userconfig: DataUserConfig, instanceController: InstanceController) {
		super(userconfig, 'Service/BonjourDiscovery', null, null)

		this.#instanceController = instanceController

		this.init()
	}

	/**
	 * Start the service if it is not already running
	 */
	protected listen(): void {
		if (this.#server === undefined) {
			try {
				this.#server = new Bonjour()

				this.logger.info('Listening for Bonjour messages')
			} catch (e) {
				this.logger.error(`Could not launch: ${stringifyError(e)}`)
			}
		}
	}

	/**
	 * Close the socket before deleting it
	 * @access protected
	 */
	protected close(): void {
		if (this.#server) {
			this.#server.destroy()
			this.#server = undefined
		}
	}

	createTrpcRouter() {
		const self = this
		return router({
			watchQuery: publicProcedure
				.input(
					z.object({
						connectionId: z.string(),
						queryId: z.string(),
					})
				)
				.subscription(async function* (opts) {
					let session: BonjourBrowserSession | undefined
					try {
						// Join the session
						session = self.#joinOrCreateSession(opts.input.connectionId, opts.input.queryId)

						// Start the changes listener
						const changes = toIterable(self.#serviceEvents, session.id, opts.signal)

						// Send the initial data
						for (const query of session.queries) {
							for (const svc of query.browser.services) {
								const uiSvc = self.#convertService(session.id, svc, query.filter)
								if (uiSvc) yield { type: 'up', service: uiSvc } satisfies ClientBonjourEvent
							}
						}

						// Stream any changes
						for await (const [data] of changes) {
							yield data
						}
					} finally {
						// Make sure we clean up the session when there are no more listeners
						if (session) self.#leaveSession(session.id)
					}
				}),
		})
	}

	#convertService(id: string, svc: DiscoveredService, filter: BonjourBrowserFilter): ClientBonjourService | null {
		// Future: whether to include ipv4, ipv6 should be configurable, but this is fine for now
		let addresses = svc.addresses
		switch (filter.addressFamily) {
			case 'ipv4+6':
				// No need to filter, include both ipv4 and ipv6
				break
			case 'ipv6':
				addresses = addresses.filter(isIPv6)
				break
			case 'ipv4':
			case undefined: // Default
				addresses = addresses.filter(isIPv4)
				break
			default:
				assertNever(filter.addressFamily)
				break
		}

		if (addresses.length === 0) return null
		if (filter.port && svc.port !== filter.port) return null
		return {
			subId: id,
			fqdn: svc.fqdn,
			name: svc.name,
			port: svc.port,
			// type: svc.type,
			// protocol: svc.protocol,
			// txt: svc.txt,
			// host: svc.host,
			addresses: addresses,
		}
	}

	/**
	 * Client is starting or joining a session
	 */
	#joinOrCreateSession(connectionId: string, queryId: string): BonjourBrowserSession {
		if (!this.#server) throw new Error('Bonjour not running')

		const id = `${connectionId}::${queryId}`
		const existingSession = this.#browsers.get(id)
		if (existingSession) {
			// If the session already exists, just return it
			this.logger.info(`Client joined ${id}`)
			return existingSession
		}

		const manifest = this.#instanceController.getManifestForConnection(connectionId)
		let bonjourQueries = manifest?.bonjourQueries?.[queryId]
		if (!bonjourQueries) throw new Error('Missing bonjour query')

		if (!Array.isArray(bonjourQueries)) bonjourQueries = [bonjourQueries]

		const filters: BonjourBrowserFilter[] = []
		for (const query of bonjourQueries) {
			const filter: BonjourBrowserFilter = {
				type: query.type,
				protocol: query.protocol,
				port: query.port,
				txt: query.txt,
				addressFamily: query.addressFamily,
			}
			if (typeof filter.type !== 'string' || !filter.type) throw new Error('Invalid type for bonjour query')
			if (typeof filter.protocol !== 'string' || !filter.protocol) throw new Error('Invalid protocol for bonjour query')

			filters.push(filter)
		}

		const session: BonjourBrowserSession = {
			id,
			queries: [],
		}
		for (const filter of filters) {
			// Create new browser
			this.logger.info(`Starting discovery of: ${JSON.stringify(filter)}`)
			const browser = this.#server.find(filter)
			session.queries.push({
				browser,
				filter,
			})

			// Setup event handlers
			browser.on('up', (svc) => {
				const uiSvc = this.#convertService(id, svc, filter)
				if (uiSvc) this.#serviceEvents.emit(id, { type: 'up', service: uiSvc })
			})
			browser.on('down', (svc) => {
				this.#serviceEvents.emit(id, { type: 'down', fqdn: svc.fqdn })
			})
		}

		// Report to client
		this.logger.info(`Client started ${id}`)
		this.#browsers.set(id, session)

		return session
	}

	/**
	 * Client is leaving a session
	 */
	#leaveSession(subId: string): void {
		this.logger.info(`Client left ${subId}`)

		// Cleanup after a timeout, as restarting the same query immediately causes it to fail
		setTimeout(() => {
			const session = this.#browsers.get(subId)
			if (session && this.#serviceEvents.listenerCount(subId) === 0) {
				this.#browsers.delete(subId)

				for (const query of session.queries) {
					this.logger.info(`Stopping discovery of: ${JSON.stringify(query.filter)}`)

					query.browser.stop()
				}
			}
		}, 500)
	}
}

interface BonjourBrowserSession {
	readonly id: string
	queries: Array<{
		browser: Browser
		filter: BonjourBrowserFilter
	}>
}

interface BonjourBrowserFilter {
	type: string
	protocol: 'tcp' | 'udp'
	port: number | undefined
	txt: Record<string, string> | undefined
	addressFamily: 'ipv4' | 'ipv6' | 'ipv4+6' | undefined
}
