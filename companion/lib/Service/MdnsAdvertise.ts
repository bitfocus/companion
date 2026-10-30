import os from 'node:os'
import { Bonjour } from '@julusian/bonjour-service'
import { API_VERSION as SATELLITE_API_VERSION } from '@companion-app/satellite-protocol'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { LinkController } from '../Link/Controller.js'
import { LINK_PROTOCOL_VERSIONS } from '../Link/Protocol/Versions.js'
import { DIRECT_MDNS_LINK_ID_TXT, DIRECT_MDNS_SERVICE_TYPE } from '../Link/Transports/Direct/Constants.js'
import { DirectServerBuiltinTransport } from '../Link/Transports/Direct/index.js'
import type { AppInfo } from '../Registry.js'
import { DISABLE_IPv6 } from '../Resources/Constants.js'
import { ServiceBase } from './Base.js'

/**
 * Class providing mDNS/Bonjour advertisement of Companion's satellite ports,
 * so that the Companion Satellite app can auto-discover this Companion, and of the port
 * accepting direct Link connections, so that other installations can.
 *
 * This is the reverse direction of {@link ServiceBonjourDiscovery}: here Companion
 * advertises itself, mirroring the conventions used by the satellite app's own announcer.
 *
 * @author Julian Waller <me@julusian.co.uk>
 * @since 5.0.0
 * @copyright 2026 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
const REPUBLISH_KEYS = new Set<string>(['installName', 'link_direct_enabled', 'link_direct_port'])

export class ServiceMdnsAdvertise extends ServiceBase {
	readonly #appInfo: AppInfo
	readonly #link: LinkController

	#bonjour: Bonjour | undefined = undefined
	/** The Link id advertised, or null when direct Link connections aren't */
	#advertisedLinkId: string | null = null

	/**
	 * Debounce timer used to coalesce rapid config changes (e.g. typing the install name)
	 * into a single republish.
	 */
	#restartTimeout: NodeJS.Timeout | undefined = undefined

	constructor(userconfig: DataUserConfig, appInfo: AppInfo, link: LinkController) {
		super(userconfig, 'Service/MdnsAdvertise', 'mdns_announcements_enabled', null)

		this.#appInfo = appInfo
		this.#link = link
		// The Link id is announced while the listener works, so announce again when it is regenerated or that changes
		const republishLink = () => {
			if (this.#linkIdToAdvertise() !== this.#advertisedLinkId) this.#scheduleRepublish()
		}
		link.on('self', republishLink)
		link.on('transportStates', republishLink)

		this.init()
	}

	listen(): void {
		if (this.#bonjour !== undefined) return

		try {
			this.#bonjour = new Bonjour()

			const name = String(this.userconfig.getKey('installName') || '').trim() || `Companion (${os.hostname()})`
			const txt = {
				id: this.#appInfo.machineId,
				version: this.#appInfo.appVersion,
				protocolVersion: SATELLITE_API_VERSION,
			}

			// Advertise a separate service per satellite port, so each SRV record points
			// straight at the port the satellite app should connect to.
			this.#publish(name, txt, 'companion-satellite-tcp', 16622)
			this.#publish(name, txt, 'companion-satellite-ws', 16623)

			const linkId = this.#linkIdToAdvertise()
			this.#advertisedLinkId = linkId
			if (linkId !== null) {
				this.#publish(
					name,
					{
						version: this.#appInfo.appVersion,
						protocolVersions: LINK_PROTOCOL_VERSIONS.join(','),
						[DIRECT_MDNS_LINK_ID_TXT]: linkId,
					},
					DIRECT_MDNS_SERVICE_TYPE,
					Number(this.userconfig.getKey('link_direct_port'))
				)
			}

			this.currentState = true

			this.logger.info(
				`Advertising Companion satellite ports${linkId !== null ? ' and direct Link connections' : ''} via mDNS`
			)
		} catch (e) {
			this.logger.error(`Could not launch: ${stringifyError(e)}`)

			// Tear down the partially-initialized instance so a later enable cycle can retry,
			// rather than leaving #bonjour populated with currentState still false.
			this.close()
		}
	}

	/** The Link id to advertise, or null while direct connections aren't accepted, eg as the port is in use */
	#linkIdToAdvertise(): string | null {
		return this.#link.isTransportConnected(DirectServerBuiltinTransport.id) ? this.#link.id : null
	}

	#publish(name: string, txt: Record<string, string>, type: string, port: number): void {
		this.#bonjour?.publish(
			{
				name,
				type,
				protocol: 'tcp',
				port,
				txt,
				ttl: 150,
				disableIPv6: DISABLE_IPv6,
			},
			{ announceOnInterval: 60 * 1000 }
		)
	}

	close(): void {
		if (this.#bonjour) {
			this.#bonjour.unpublishAll()
			this.#bonjour.destroy()
			this.#bonjour = undefined
		}
	}

	override updateUserConfig(key: string, value: boolean | number | string): void {
		// Let the base class handle enable/disable via the mdns_announcements_enabled key
		super.updateUserConfig(key, value)

		// The advertised services are derived from these, so republish when they change
		if (REPUBLISH_KEYS.has(key)) this.#scheduleRepublish()
	}

	#scheduleRepublish(): void {
		if (!this.currentState) return

		if (this.#restartTimeout) clearTimeout(this.#restartTimeout)
		this.#restartTimeout = setTimeout(() => {
			this.#restartTimeout = undefined
			this.restartModule()
		}, 50)
	}
}
