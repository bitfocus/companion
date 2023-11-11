import ServiceBase from './Base.js'
import net, { Socket } from 'net'

/**
 * Abstract class providing base functionality for TCP services.
 *
 * @extends ServiceBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
 * @abstract
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
class ServiceTcpBase extends ServiceBase {
	/**
	 * @type {net.Server | undefined}
	 * @access protected
	 */
	server = undefined

	/**
	 * This stored client sockets
	 * @type {Array<Socket>}
	 * @access protected
	 */
	clients = []

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, 'module_name', 'module_path', enableConfig, portConfig)</code>.
	 * @param {import('../Registry.js').default} registry - the core registry
	 * @param {string} logSource - module name to be used in UI logs
	 * @param {string} debugNamespace - module path to be used in the debugger
	 * @param {?string} enableConfig - the key for the userconfig that sets if the module is enabled or disabled
	 * @param {?string} portConfig - the key for the userconfig that sets the service ports
	 */
	constructor(registry, logSource, debugNamespace, enableConfig, portConfig) {
		super(registry, logSource, debugNamespace, enableConfig, portConfig)
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.portConfig) {
			this.port = this.userconfig.getKey(this.portConfig)
		}

		if (this.server === undefined) {
			try {
				this.server = net.createServer((client) => {
					/** @type {TcpClientInfo} */
					const clientInfo = {
						name: client.remoteAddress + ':' + client.remotePort,
						receiveBuffer: '',
						socket: client,
					}

					client.on('end', () => {
						this.clients.splice(this.clients.indexOf(client), 1)
						this.logger.debug('Client disconnected: ' + clientInfo.name)
					})

					client.on('error', () => {
						this.clients.splice(this.clients.indexOf(client), 1)
						this.logger.error('Client errored/died: ' + clientInfo.name)
					})

					this.clients.push(client)

					this.logger.debug('Client connected: ' + clientInfo.name)

					client.on('data', this.processIncoming.bind(this, clientInfo))

					if (this.initSocket !== undefined && typeof this.initSocket == 'function') {
						this.initSocket(clientInfo)
					}
				})

				this.server.on('error', this.handleSocketError.bind(this))

				this.server.listen(this.port)
				this.currentState = true
				this.logger.info('Listening on port ' + this.port)
			} catch (/** @type {any} */ e) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	/**
	 * Process an incoming message from a client
	 * @param {TcpClientInfo} _client - the client's tcp socket
	 * @param {string} _chunk - the incoming message part
	 * @access protected
	 * @abstract
	 */
	processIncoming(_client, _chunk) {}

	/**
	 * @type {((socket: TcpClientInfo) => void) | undefined}
	 */
	initSocket
}

export default ServiceTcpBase

/**
 * @typedef {{
 *   name: string
 *   receiveBuffer: string
 *   socket: Socket
 * }} TcpClientInfo
 */
