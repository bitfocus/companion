import { decimalToRgb } from '../Resources/Util.js'
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
		super(registry, 'tcp', 'lib/Service/Tcp', 'tcp_enabled', 'tcp_listen_port')
		this.api = api

		this.system.on('graphics_set_bank_bg', (page, bank, bgcolor) => {
			if (this.clients) {
				let color = decimalToRgb(bgcolor)
				let response = {}
				response.type = 'bank_bg_change'
				response.page = page
				response.bank = bank
				response.red = color.red
				response.green = color.green
				response.blue = color.blue
				this.debug(`bank_bg send to all open sockets ${JSON.stringify(response)}`)
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

		this.receiveBuffer += chunk

		while ((i = this.receiveBuffer.indexOf('\n', offset)) !== -1) {
			line = this.receiveBuffer.substr(offset, i - offset)
			offset = i + 1
			this.api.parseApiCommand(line.toString().replace(/\r/, ''), (err, res) => {
				if (err == null) {
					this.debug('TCP command succeeded')
				} else {
					this.debug('TCP command failed')
				}
				client.write(res + '\n')
			})
		}

		this.receiveBuffer = this.receiveBuffer.substr(offset)
	}
}

export default ServiceTcp
