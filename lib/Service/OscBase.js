import ServiceBase from './Base.js'
import OSC from 'osc'

/**
 * Abstract class providing base functionality for OSC services.
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
class ServiceOscBase extends ServiceBase {
	/**
	 * @type {OSC.UDPPort | undefined}
	 * @access protected
	 */
	server = undefined

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
			this.port = Number(this.userconfig.getKey(this.portConfig))
		}

		if (this.server === undefined) {
			try {
				this.server = new OSC.UDPPort({
					localAddress: '0.0.0.0',
					localPort: this.port,
					broadcast: true,
					metadata: true,
				})

				this.server.on('error', this.handleSocketError.bind(this))

				this.server.open()

				this.server.on('message', this.processIncoming.bind(this))
				this.currentState = true

				if (this.port == 0) {
					this.logger.debug('Ready to send OSC commands')
				} else {
					this.logger.info('Listening on port ' + this.port)
				}
			} catch (/** @type {any} */ e) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	/**
	 * Process an incoming message from a client
	 * @param {import('osc').OscMessage} _message - the incoming message part
	 * @access protected
	 * @abstract
	 */
	processIncoming(_message) {}
}

export default ServiceOscBase
