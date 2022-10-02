import { decimalToRgb } from '../Resources/Util.js'
import { ApiMessageError } from './Api.js'
import ServiceTcpBase from './TcpBase.js'

/**
 * Class providing the TCP api.
 *
 * @extends ServiceTcpBase
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
class ServiceTcp extends ServiceTcpBase {
	/**
	 * The service api command processor
	 * @type {?ServiceApi}
	 * @access protected
	 */
	api
	/**
	 * The port to open the socket with.  Default: <code>16759</code>
	 * @type {number}
	 * @access protected
	 */
	port = 16759

	/**
	 * @param {Registry} registry - the application core
	 * @param {ServiceApi} api - the handler for incoming api commands
	 */
	constructor(registry, api) {
		super(registry, 'tcp', 'Service/Tcp', 'tcp_enabled', 'tcp_listen_port')
		this.api = api

		this.graphics.on('bank_invalidated', (page, bank, render) => {
			const bgcolor = render.style?.bgcolor || 0

			if (this.clients && this.clients.length > 0) {
				const color = decimalToRgb(bgcolor)
				const response = {
					type: 'bank_bg_change',
					page: page,
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
	 * @param {Socket} client - the client's tcp socket
	 * @param {string} chunk - the incoming message part
	 * @access protected
	 */
	processIncoming(client, chunk) {
		let i = 0,
			line = '',
			offset = 0

		client.receiveBuffer += chunk

		while ((i = client.receiveBuffer.indexOf('\n', offset)) !== -1) {
			line = client.receiveBuffer.substr(offset, i - offset)
			offset = i + 1
			this.api
				.parseApiCommand(line.toString().trim())
				.then((res) => {
					this.logger.silly(`TCP command succeeded: ${res}`)

					let msg = '+OK'
					if (res) msg += ` ${res}`
					client.write(`${msg}\n`)
				})
				.catch((e) => {
					this.logger.silly(`TCP command failed: ${e}`)
					this.logger.info(`TCP command failed: ${e}`)

					if (e instanceof ApiMessageError) {
						client.write(`-ERR ${e?.message ?? ''}\n`)
					} else {
						client.write(`-ERR Internal Error\n`)
					}
				})
		}

		client.receiveBuffer = client.receiveBuffer.substr(offset)
	}
}

export default ServiceTcp
