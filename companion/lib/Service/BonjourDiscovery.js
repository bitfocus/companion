import { isEqual } from 'lodash-es'
import ServiceBase from './Base.js'
import { Bonjour, Browser } from '@julusian/bonjour-service'
import { nanoid } from 'nanoid'
import { isIPv4 } from 'net'

/**
 * Generate socket.io room name
 * @param {string} id
 * @returns {string}
 */
function BonjourRoom(id) {
	return `bonjour:${id}`
}

/**
 * Class providing Bonjour discovery for modules.
 *
 * @extends ServiceBase
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class ServiceBonjourDiscovery extends ServiceBase {
	/**
	 * @type {Bonjour | undefined}
	 * @access protected
	 */
	server = undefined

	/**
	 * Active browsers running
	 * @type {Map<string, BonjourBrowserSession>}
	 */
	#browsers = new Map()

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'Service/BonjourDiscovery', null, null)

		this.init()
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.server === undefined) {
			try {
				this.server = new Bonjour()

				this.logger.info('Listening for Bonjour messages')
			} catch (/** @type {any} */ e) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	/**
	 * Close the socket before deleting it
	 * @access protected
	 */
	close() {
		if (this.server) {
			this.server.destroy()
		}
	}

	/**
	 * Setup a new socket client's events
	 * @param {import('../UI/Handler.js').ClientSocket} client - the client socket
	 * @access public
	 */
	clientConnect(client) {
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

	/**
	 * @param {string} id
	 * @param {any} svc
	 * @returns {import('@companion-app/shared/Model/Common.js').ClientBonjourService | null}
	 */
	#convertService(id, svc) {
		// Future: whether to include ipv4, ipv6 should be configurable, but this is fine for now
		const addresses = svc.addresses.filter((/** @type {string} */ addr) => isIPv4(addr))
		if (addresses.length === 0) return null

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
	 * @param {import('../UI/Handler.js').ClientSocket} client
	 * @param {string} connectionId
	 * @param {string} queryId
	 * @returns {string[]} subIds
	 */
	#joinOrCreateSession(client, connectionId, queryId) {
		if (!this.server) throw new Error('Bonjour not running')

		const manifest = this.instance.getManifestForInstance(connectionId)
		/** @type {import('@companion-module/base/generated/manifest.js').ModuleBonjourQuery | import('@companion-module/base/generated/manifest.js').ModuleBonjourQuery[] | undefined} */
		let bonjourQueries = manifest?.bonjourQueries?.[queryId]
		if (!bonjourQueries) throw new Error('Missing bonjour query')

		if (!Array.isArray(bonjourQueries)) bonjourQueries = [bonjourQueries]

		/** @type {BonjourBrowserFilter[]} */
		const filters = []

		for (const query of bonjourQueries) {
			const filter = {
				type: query.type,
				protocol: query.protocol,
				txt: query.txt,
			}
			if (typeof filter.type !== 'string' || !filter.type) throw new Error('Invalid type for bonjour query')
			if (typeof filter.protocol !== 'string' || !filter.protocol) throw new Error('Invalid protocol for bonjour query')

			filters.push(filter)
		}

		/** @type {string[]} */
		const ids = []

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
							const uiSvc = this.#convertService(id, svc)
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
				const browser = this.server.find(filter)
				const id = nanoid()
				const room = BonjourRoom(id)
				this.#browsers.set(id, {
					browser,
					filter,
					clientIds: new Set([client.id]),
				})

				// Setup event handlers
				browser.on('up', (svc) => {
					const uiSvc = this.#convertService(id, svc)
					if (uiSvc) this.io.emitToRoom(room, `bonjour:service:up`, uiSvc)
				})
				browser.on('down', (svc) => {
					this.io.emitToRoom(room, `bonjour:service:down`, id, svc.fqdn)
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
	 * @param {import('../UI/Handler.js').ClientSocket} client
	 * @param {string[]} subIds
	 */
	#leaveSession(client, subIds) {
		for (const subId of subIds) {
			this.logger.info(`Client ${client.id} left ${subId}`)
			client.leave(BonjourRoom(subId))

			this.#removeClientFromSession(client.id, subId)
		}
	}

	/**
	 * Remove a client from a session
	 * @param {string} clientId
	 * @param {string} subId
	 * @returns {void}
	 */
	#removeClientFromSession(clientId, subId) {
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

export default ServiceBonjourDiscovery

/**
 * @typedef {{
 *   browser: Browser
 *   filter: BonjourBrowserFilter
 *   clientIds: Set<string>
 * }} BonjourBrowserSession
 *
 * @typedef {{
 *   type: string
 *   protocol: 'tcp' | 'udp'
 *   txt: Record<string, string> | undefined
 * }} BonjourBrowserFilter
 */
