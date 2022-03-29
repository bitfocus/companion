import OSC from 'osc'
import ServiceOscBase from './OscBase.js'

/**
 * Class providing OSC send services.
 *
 * @extends ServiceBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 1.0.7
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
class ServiceOscSender extends ServiceOscBase {
	/**
	 * The port to open the socket with.  Default: <code>0</code> (random)
	 * @type {number}
	 * @access protected
	 */
	port = 0

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'osc-tx', 'lib/Service/OscSender')

		/**
		 * Send an OSC command to a host.  See {@link ServiceOscSender#send|ServiceOscSender}
		 * @event System~osc_send
		 * @param {string} host - the receiving host
		 * @param {number} port - the receiving port
		 * @param {string} path - the OSC path
		 * @param {?ServiceOsc~CompanionOSCArgument[]} args - arguments to include
		 */
		this.system.on('osc_send', this.send.bind(this))
		/**
		 * Send multiple OSC commands to a host.  See {@link ServiceOscSender#sendBundle|ServiceOscSender}
		 * @event System~osc_send_bundle
		 * @param {string} host - the receiving host
		 * @param {number} port - the receiving port
		 * @param {number} time - OSC 64-bit time tag (see OSC specification); <code>0</code> to send immediately
		 * @param {ServiceOsc~CompanionOSCBundle[]} bundle - the packages to send
		 */
		this.system.on('osc_send_bundle', this.sendBundle.bind(this))

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param {string} message - the incoming message part
	 * @access protected
	 */
	processIncoming(message) {}

	/**
	 * Send an OSC command to a host
	 * @param {string} host - the receiving host
	 * @param {number} port - the receiving port
	 * @param {string} path - the OSC path
	 * @param {?ServiceOscSender~CompanionOSCArgument[]} args - arguments to include
	 * @access public
	 */
	send(host, port, path, args) {
		if (this.server !== undefined) {
			this.server.send(
				{
					address: path,
					args: args,
				},
				host,
				port
			)
		}
	}

	/**
	 * Send multiple OSC commands to a host
	 * @param {string} host - the receiving host
	 * @param {number} port - the receiving port
	 * @param {number} time - OSC 64-bit time tag (see OSC specification); <code>0</code> to send immediately
	 * @param {ServiceOscSender~CompanionOSCBundle[]} bundle - the packages to send
	 * @access public
	 */
	sendBundle(host, port, time, bundle) {
		if (this.server !== undefined && bundle !== undefined) {
			this.server.send(
				{
					timeTag: OSC.timeTag(time),
					packets: bundle,
				},
				host,
				port
			)
		}
	}
}

/**
 * An argument to include with an OSC package
 * @typedef ServiceOscSender~CompanionOSCArgument
 * @property {string} type - 'f' = float | 'i' = int | 's' = string
 * @property {number|string} value - the agrument's value
 */

/**
 * A full OSC package when sending a bundle
 * @typedef ServiceOscSender~CompanionOSCBundle
 * @property {string} address - the OSC path
 * @property {ServiceOscSender~CompanionOSCArgument[]} args - arguments to include
 */
export default ServiceOscSender
