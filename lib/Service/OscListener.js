import ServiceOscBase from './OscBase.js'
import { ServiceOscApi } from './OscApi.js'

/**
 * Class providing OSC receive services.
 *
 * @extends ServiceOscBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.2.0
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
class ServiceOscListener extends ServiceOscBase {
	/**
	 * The port to open the socket with.  Default: <code>12321</code>
	 * @type {number}
	 * @access protected
	 */
	port = 12321

	/**
	 * Api router
	 * @type {ServiceOscApi}
	 * @access private
	 */
	#api

	/**
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'osc-rx', 'Service/OscListener', 'osc_enabled', 'osc_listen_port')

		this.init()

		this.#api = new ServiceOscApi(registry)
	}

	/**
	 * Process an incoming message from a client
	 * @param {import('osc').OscReceivedMessage} message - the incoming message part
	 * @access protected
	 */
	processIncoming(message) {
		try {
			this.#api.router.processMessage(message.address, message)
		} catch (error) {
			this.logger.warn('OSC Error: ' + error)
		}
	}
}

export default ServiceOscListener
