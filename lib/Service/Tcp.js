const ServiceTcpBase = require('./TcpBase')

/**
 * Class providing the TCP api.
 *
 * @extends ServiceTcpBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 1.3.0
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
class ServiceTcp extends ServiceTcpBase {
	/**
	 * The service api command processor
	 * @type {ServiceApi}
	 * @access protected
	 */
	api = null

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Service/Tcp')

	/**
	 * The port to open the socket with.  Default: <code>51234</code>
	 * @type {number}
	 * @access protected
	 */
	port = 51234

	/**
	 * @param {Registry} registry - the core registry
	 * @param {ServiceApi} api - the handler for incoming api commands
	 */
	constructor(registry, api) {
		super(registry, 'tcp_server')

		this.api = api

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param {net.Socket} client - the client's tcp socket
	 * @param {string} chunk - the incoming message part
	 * @access protected
	 */
	processIncoming(client, chunk) {
		let i = 0,
			line = '',
			offset = 0
		this.receivebuffer += chunk

		while ((i = this.receivebuffer.indexOf('\n', offset)) !== -1) {
			line = this.receivebuffer.substr(offset, i - offset)
			offset = i + 1

			this.api.parseApiCommand(line.toString().replace(/\r/, ''), (err, res) => {
				if (err == null) {
					this.debug('{$this.logSource} command succeeded')
				} else {
					this.debug('{$this.logSource} command failed')
				}

				client.write(res + '\n')
			})
		}

		this.receivebuffer = this.receivebuffer.substr(offset)
	}
}

exports = module.exports = ServiceTcp
