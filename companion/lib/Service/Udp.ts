import { ServiceTcpUdpApi } from './TcpUdpApi.js'
import { DgramRemoteInfo, ServiceUdpBase } from './UdpBase.js'
import type { Registry } from '../Registry.js'

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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ServiceUdp extends ServiceUdpBase {
	/**
	 * The service api command processor
	 */
	readonly #api: ServiceTcpUdpApi

	constructor(registry: Registry) {
		super(registry, 'Service/Udp', 'udp_enabled', 'udp_listen_port')

		this.port = 16759

		this.#api = new ServiceTcpUdpApi(registry, 'udp', 'udp_legacy_api_enabled')

		this.init()
	}

	/**
	 * Process an incoming message from a remote
	 */
	protected override processIncoming(data: Buffer, remote: DgramRemoteInfo) {
		this.logger.silly(`${remote.address}:${remote.port} received packet: "${data.toString().trim()}"`)

		this.#api
			.parseApiCommand(data.toString())
			.then((res) => {
				this.logger.silly(`UDP command succeeded: ${res}`)
			})
			.catch((e) => {
				this.logger.silly(`UDP command failed: ${e}`)
			})
	}
}
