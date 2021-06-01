const ServiceBase = require('./Base')
const net = require('net')

/**
 * Abstract class providing base functionality for TCP services.
 *
 * @extends ServiceBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 * @abstract
 * @copyright 2021 Bitfocus AS
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
	 * This needs to be called in the extending class
	 * using <code>super(registry, 'module_name', defaults, defaultItem)</code>.
	 * @param {Registry} registry - the core registry
	 * @param {string} logSource - module name to be used in UI logs
	 * @param {?Object} defaults - default values for related system settings
	 * @param {?string} defaultItem - the key for the userconfig that sets if the module is enabled or disabled
	 */
	constructor(registry, logSource, defaults, defaultItem) {
		super(registry, logSource, defaults, defaultItem)

		this.clients = []
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.receiveBuffer === undefined) {
			this.receiveBuffer = ''
		}

		if (this.socket === undefined) {
			try {
				this.socket = net.createServer((client) => {
					client.on('end', () => {
						this.clients.splice(this.clients.indexOf(client), 1)
						this.debug('Client disconnected: ' + client.name)
						this.log('debug', 'Client disconnected: ' + client.name)
					})

					client.on('error', () => {
						this.clients.splice(this.clients.indexOf(client), 1)
						this.debug('Client debug disconnected: ' + client.name)
						this.log('error', 'Client errored/died: ' + client.name)
					})

					client.name = client.remoteAddress + ':' + client.remotePort
					this.clients.push(client)
					this.debug('Client connected: ' + client.name)

					this.log('debug', 'Client connected: ' + client.name)

					client.on('data', this.processIncoming.bind(this, client))

					if (this.initClient !== undefined && typeof this.initClient == 'function') {
						this.initClient(client)
					}
				})

				this.socket.on('error', this.handleSocketError.bind(this))

				this.socket.listen(this.port)
				this.currentState = true
				this.log('debug', 'Listening on port ' + this.port)
				this.debug('Listening on port ' + this.port)
			} catch (e) {
				this.log('error', `${this.logSource} could not launch`)
			}
		}
	}

	/**
	 * Process an incoming message from a client
	 * @param {net.Socket} client - the client's tcp socket
	 * @param {string} chunk - the incoming message part
	 * @access protected
	 * @abstract
	 */
	processIncoming(client, chunk) {}
}

exports = module.exports = ServiceTcpBase
