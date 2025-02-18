import { decimalToRgb } from '../Resources/Util.js'
import { ApiMessageError, ServiceTcpUdpApi } from './TcpUdpApi.js'
import { ServiceTcpBase, TcpClientInfo } from './TcpBase.js'
import { xyToOldBankIndex } from '@companion-app/shared/ControlId.js'
import type { Registry } from '../Registry.js'

/**
 * Class providing the TCP api.
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
export class ServiceTcp extends ServiceTcpBase {
	/**
	 * The service api command processor
	 */
	readonly #api: ServiceTcpUdpApi

	constructor(registry: Registry) {
		super(registry, 'Service/Tcp', 'tcp_enabled', 'tcp_listen_port')

		this.port = 16759

		this.#api = new ServiceTcpUdpApi(registry, 'tcp', 'tcp_legacy_api_enabled')

		this.graphics.on('button_drawn', (location, render) => {
			// TODO-layered: reimplement for layered buttons
			const bgcolor =
				(typeof render.style !== 'string' && render.style?.style === 'button' ? render.style : {})?.bgcolor || 0

			const bank = xyToOldBankIndex(location.column, location.row)

			/** TODO: remove legacy 'bank' from this response */
			if (this.clients.size > 0 && bank !== null) {
				const color = decimalToRgb(bgcolor)
				const response = {
					type: 'bank_bg_change',
					page: location.pageNumber,
					row: location.row,
					column: location.column,
					bank: bank,
					red: color.red,
					green: color.green,
					blue: color.blue,
				}

				this.logger.silly(`bank_bg send to all open sockets ${JSON.stringify(response)}`)
				this.clients.forEach((socket) => {
					socket.write(JSON.stringify(response) + '\n')
				})
			}
		})

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param client - the client's tcp socket
	 * @param chunk - the incoming message part
	 */
	protected processIncoming(client: TcpClientInfo, chunk: string): void {
		let i = 0,
			line = '',
			offset = 0

		client.receiveBuffer += chunk

		while ((i = client.receiveBuffer.indexOf('\n', offset)) !== -1) {
			line = client.receiveBuffer.substr(offset, i - offset)
			offset = i + 1
			this.#api
				.parseApiCommand(line.toString().trim())
				.then((res) => {
					this.logger.silly(`TCP command succeeded: ${res}`)

					let msg = '+OK'
					if (res) msg += ` ${res}`
					client.socket.write(`${msg}\n`)
				})
				.catch((e) => {
					this.logger.silly(`TCP command failed: ${e}`)
					this.logger.info(`TCP command failed: ${e}`)

					if (e instanceof ApiMessageError) {
						client.socket.write(`-ERR ${e?.message ?? ''}\n`)
					} else {
						client.socket.write(`-ERR Internal Error\n`)
					}
				})
		}

		client.receiveBuffer = client.receiveBuffer.substr(offset)
	}
}
