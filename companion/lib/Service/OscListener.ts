import { ServiceOscBase } from './OscBase.js'
import { ServiceOscApi } from './OscApi.js'
import type { OscReceivedMessage } from 'osc'
import type { ServiceApi } from './ServiceApi.js'
import type { DataUserConfig } from '../Data/UserConfig.js'

/**
 * Class providing OSC receive services.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.2.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ServiceOscListener extends ServiceOscBase {
	/**
	 * Api router
	 */
	readonly #api: ServiceOscApi

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/OscListener', 'osc_enabled', 'osc_listen_port')

		this.port = 12321

		this.init()

		this.#api = new ServiceOscApi(serviceApi, userconfig)
	}

	/**
	 * Process an incoming message from a client
	 */
	protected override processIncoming(message: OscReceivedMessage) {
		try {
			this.#api.router.processMessage(message.address, message)
		} catch (error) {
			this.logger.warn('OSC Error: ' + error)
		}
	}
}
