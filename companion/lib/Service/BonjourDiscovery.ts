import { isEqual } from 'lodash-es'
import { ServiceBase } from './Base.js'
import { Bonjour, Browser } from '@julusian/bonjour-service'
import { nanoid } from 'nanoid'
import { isIPv4 } from 'net'
import type { ClientSocket, UIHandler } from '../UI/Handler.js'
import type { ClientBonjourService } from '@companion-app/shared/Model/Common.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { InstanceController } from '../Instance/Controller.js'

/**
 * Generate socket.io room name
 */
function BonjourRoom(id: string): string {
	return `bonjour:${id}`
}

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
	readonly #io: UIHandler
	readonly #instanceController: InstanceController

	/**
	 * Active browsers running
	 */
	#browsers = new Map<string, BonjourBrowserSession>()

	#server: Bonjour | undefined

	constructor(userconfig: DataUserConfig, io: UIHandler, instanceController: InstanceController) {
		super(userconfig, 'Service/BonjourDiscovery', null, null)

		this.#io = io
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
			} catch (e: any) {
				this.logger.error(`Could not launch: ${e.message}`)
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

	/**
	 * Setup a new socket client's events
	 */
	clientConnect(client: ClientSocket): void {
		client.on('disconnect', () => {
			// Ensure any sessions the client was part of are cleaned up
			for (const subId of this.#browsers.keys()) {
				this.#removeClientFromSession(client.id, subId)
			}
		})

		client.onPromise('bonjour:subscribe', (connectionId, queryId) =>
			this.#joinOrCreateSession(client, connectionId, queryId)
		)
		client.on('bonjour:unsubscribe', (subIds) => this.#leaveSession(client, subIds))
	}

	#convertService(id: string, svc: any, filter: BonjourBrowserFilter): ClientBonjourService | null {
		// Future: whether to include ipv4, ipv6 should be configurable, but this is fine for now
		const addresses = svc.addresses.filter((addr: string) => isIPv4(addr))
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
	#joinOrCreateSession(client: ClientSocket, connectionId: string, queryId: string): string[] {
		if (!this.#server) throw new Error('Bonjour not running')

		const manifest = this.#instanceController.getManifestForInstance(connectionId)
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
			}
			if (typeof filter.type !== 'string' || !filter.type) throw new Error('Invalid type for bonjour query')
			if (typeof filter.protocol !== 'string' || !filter.protocol) throw new Error('Invalid protocol for bonjour query')

			filters.push(filter)
		}

		const ids: string[] = []

		for (const filter of filters) {
			let foundExisting = false

			// Find existing browser
			for (const [id, session] of this.#browsers.entries()) {
				if (isEqual(session.filter, filter)) {
					session.clientIds.add(client.id)

					client.join(BonjourRoom(id))
					this.logger.info(`Client ${client.id} joined ${id}`)

					// After this message, send already known services to the client
					setImmediate(() => {
						for (const svc of session.browser.services) {
							const uiSvc = this.#convertService(id, svc, filter)
							if (uiSvc) client.emit(`bonjour:service:up`, uiSvc)
						}
					})

					foundExisting = true
					ids.push(id)
					break
				}
			}

			if (!foundExisting) {
				// Create new browser
				this.logger.info(`Starting discovery of: ${JSON.stringify(filter)}`)
				const browser = this.#server.find(filter)
				const id = nanoid()
				const room = BonjourRoom(id)
				this.#browsers.set(id, {
					browser,
					filter,
					clientIds: new Set([client.id]),
				})

				// Setup event handlers
				browser.on('up', (svc) => {
					const uiSvc = this.#convertService(id, svc, filter)
					if (uiSvc) this.#io.emitToRoom(room, `bonjour:service:up`, uiSvc)
				})
				browser.on('down', (svc) => {
					this.#io.emitToRoom(room, `bonjour:service:down`, id, svc.fqdn)
				})

				// Report to client
				client.join(room)
				this.logger.info(`Client ${client.id} joined ${id}`)
				ids.push(id)
			}
		}

		return ids
	}

	/**
	 * Client is leaving a session
	 */
	#leaveSession(client: ClientSocket, subIds: string[]): void {
		for (const subId of subIds) {
			this.logger.info(`Client ${client.id} left ${subId}`)
			client.leave(BonjourRoom(subId))

			this.#removeClientFromSession(client.id, subId)
		}
	}

	/**
	 * Remove a client from a session
	 */
	#removeClientFromSession(clientId: string, subId: string): void {
		const session = this.#browsers.get(subId)
		if (!session || !session.clientIds.delete(clientId)) return

		// Cleanup after a timeout, as restarting the same query immediately causes it to fail
		setTimeout(() => {
			if (this.#browsers.has(subId) && session.clientIds.size === 0) {
				this.logger.info(`Stopping discovery of: ${JSON.stringify(session.filter)}`)

				this.#browsers.delete(subId)

				session.browser.stop()
			}
		}, 500)
	}
}

interface BonjourBrowserSession {
	browser: Browser
	filter: BonjourBrowserFilter
	clientIds: Set<string>
}

interface BonjourBrowserFilter {
	type: string
	protocol: 'tcp' | 'udp'
	port: number | undefined
	txt: Record<string, string> | undefined
}
