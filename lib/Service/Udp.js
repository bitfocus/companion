const ServiceUdpBase = require('./UdpBase')

/**
 * Class providing the UDP api.
 *
 * @extends ServiceUdpBase
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
class ServiceUdp extends ServiceUdpBase {
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
	 * The port to open the socket with.  Default: <code>51235</code>
	 * @type {number}
	 * @access protected
	 */
	port = 51235

	/**
	 * @param {Registry} registry - the core registry
	 * @param {ServiceApi} api - the handler for incoming api commands
	 */
	constructor(registry, api) {
		super(registry, 'udp_server')

		this.api = api

		this.init()
	}

	/**
	 * Process an incoming message from a remote
	 * @param {Buffer} data - the incoming message
	 * @param {ServiceUdpBase~DgramRemoteInfo} remote - remote address information
	 */
	processIncoming(data, remote) {
		this.debug(remote.address + ':' + remote.port + ' received packet: ' + data.toString().trim())

		this.api.parseApiCommand(data.toString(), (err, res) => {
			if (err == null) {
				this.debug('UDP command succeeded')
			} else {
				this.debug('UDP command failed')
			}
		})
	}
}

exports = module.exports = ServiceUdp
