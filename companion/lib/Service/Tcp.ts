import { decimalToRgb } from '../Resources/Util.js'
import { ApiMessageError, ServiceTcpUdpApi } from './TcpUdpApi.js'
import { ServiceTcpBase, type TcpClientInfo } from './TcpBase.js'
import type { ServiceApi } from './ServiceApi.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ImageResult } from '../Graphics/ImageResult.js'

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
 */
export class ServiceTcp extends ServiceTcpBase {
	/**
	 * The service api command processor
	 */
	readonly #api: ServiceTcpUdpApi

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/Tcp', 'tcp_enabled', 'tcp_listen_port')

		this.port = 16759

		this.#api = new ServiceTcpUdpApi(serviceApi, userconfig, 'tcp', 'tcp_legacy_api_enabled')

		this.init()
	}

	onButtonDrawn(location: ControlLocation, render: ImageResult): void {
		const bgcolor = (typeof render.style !== 'string' ? render.style : {})?.bgcolor || 0

		if (this.clients.size > 0) {
			const color = decimalToRgb(bgcolor)
			const response = {
				type: 'bank_bg_change',
				page: location.pageNumber,
				row: location.row,
				column: location.column,
				red: color.red,
				green: color.green,
				blue: color.blue,
			}

			this.logger.silly(`bank_bg send to all open sockets ${JSON.stringify(response)}`)
			this.clients.forEach((socket) => {
				socket.write(JSON.stringify(response) + '\n')
			})
		}
	}

	/**
	 * Process an incoming message from a client
	 * @param client - the client's tcp socket
	 * @param chunk - the incoming message part
	 */
	protected processIncoming(client: TcpClientInfo, chunk: string | Buffer): void {
		let i = 0,
			line = '',
			offset = 0

		client.receiveBuffer += chunk
		// note that chunk is actually a Buffer, not a string. (It could be any of 'string', 'Buffer', 'TypedArray', 'DataView'.)
		// There may be a way to setEncoding() on the TCP stream.. But for now, it's simpler to just be more explicit about the type.
		this.logger.debug(`TCP message received from ${client.name} - ${JSON.stringify(chunk.toString())}`)

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

					if (e instanceof ApiMessageError) {
						this.logger.info(`TCP command failed. ${e} ${e.context}`)
						client.socket.write(`-ERR ${e?.message ?? ''}\n`)
					} else {
						this.logger.info(`TCP command failed. ${e}`)
						client.socket.write(`-ERR Internal Error\n`)
					}
				})
		}

		client.receiveBuffer = client.receiveBuffer.substr(offset)
	}
}
