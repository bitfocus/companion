import { ServiceTcpUdpApi } from './TcpUdpApi.js'
import { ServiceUdpBase, type DgramRemoteInfo } from './UdpBase.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { ServiceApi } from './ServiceApi.js'

/**
 * Class providing the UDP api.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.3.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ServiceUdp extends ServiceUdpBase {
	/**
	 * The service api command processor
	 */
	readonly #api: ServiceTcpUdpApi

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/Udp', 'udp_enabled', 'udp_listen_port')

		this.port = 16759

		this.#api = new ServiceTcpUdpApi(serviceApi, userconfig, 'udp', 'udp_legacy_api_enabled')

		this.init()
	}

	/**
	 * Process an incoming message from a remote
	 */
	protected override processIncoming(data: Buffer, remote: DgramRemoteInfo): void {
		this.logger.silly(`${remote.address}:${remote.port} received packet: "${data.toString().trim()}"`)
		this.logger.debug(`UDP packet received from ${remote.address}:${remote.port} - ${JSON.stringify(data.toString())}`)

		this.#api
			.parseApiCommand(data.toString())
			.then((res) => {
				this.logger.silly(`UDP command succeeded: ${res}`)
			})
			.catch((e) => {
				this.logger.silly(`UDP command failed: ${e}`)
				this.logger.info(`UDP command failed: ${e}`)
			})
	}
}
