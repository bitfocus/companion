import os from 'node:os'
import { Bonjour } from '@julusian/bonjour-service'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { AppInfo } from '../Registry.js'
import { DISABLE_IPv6 } from '../Resources/Constants.js'
import { ServiceBase } from './Base.js'
import { API_VERSION as SATELLITE_API_VERSION } from './Satellite/SatelliteApi.js'

/**
 * Class providing mDNS/Bonjour advertisement of Companion's satellite ports,
 * so that the Companion Satellite app can auto-discover this Companion.
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
export class ServiceMdnsAdvertise extends ServiceBase {
	readonly #appInfo: AppInfo

	#bonjour: Bonjour | undefined = undefined

	/**
	 * Debounce timer used to coalesce rapid config changes (e.g. typing the install name)
	 * into a single republish.
	 */
	#restartTimeout: NodeJS.Timeout | undefined = undefined

	constructor(userconfig: DataUserConfig, appInfo: AppInfo) {
		super(userconfig, 'Service/MdnsAdvertise', 'mdns_announcements_enabled', null)

		this.#appInfo = appInfo

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

			this.currentState = true

			this.logger.info('Advertising Companion satellite ports via mDNS')
		} catch (e) {
			this.logger.error(`Could not launch: ${stringifyError(e)}`)
		}
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

		// The advertised service name is derived from the install name, so republish when it changes
		if (key === 'installName' && this.currentState) {
			if (this.#restartTimeout) clearTimeout(this.#restartTimeout)
			this.#restartTimeout = setTimeout(() => {
				this.#restartTimeout = undefined
				this.restartModule()
			}, 50)
		}
	}
}
