const ServiceBase = require('./Base')
const dgram = require('dgram')

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
class ServiceUdpBase extends ServiceBase {
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
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.socket === undefined) {
			try {
				this.socket = dgram.createSocket('udp4', this.processIncoming.bind(this))

				this.socket.on('error', (err) => {
					debug('UDP server error:', err.stack)
					//this.socket.close();
				})

				this.socket.bind(this.port)
				this.currentState = true
				this.log('debug', 'Listening on port ' + this.port)
				this.debug('Listening on port ' + this.port)
			} catch (e) {
				debug('UDP server error:', e.stack)
			}
		}
	}

	/**
	 * Process an incoming message from a remote
	 * @param {Buffer} data - the incoming message
	 * @param {ServiceUdpBase~DgramRemoteInfo} remote - remote address information
	 */
	processIncoming(data, remote) {}
}

/**
 * @typedef ServiceUdpBase~DgramRemoteInfo
 * @property {string} address - the sender address
 * @property {string} family - the address family (<code>'IPV4'</code> or <code>'IPV6'</code>)
 * @property {number} port - the sender port
 * @property {number} size - the message size
 */
exports = module.exports = ServiceUdpBase
