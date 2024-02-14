import OSC from 'osc'
import ServiceOscBase from './OscBase.js'

/**
 * Class providing OSC send services.
 *
 * @extends ServiceOscBase
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
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'osc-tx', 'Service/OscSender', null, null)

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param {import('osc').OscMessage} _message - the incoming message part
	 * @access protected
	 */
	processIncoming(_message) {}

	/**
	 * Send an OSC command to a host
	 * @param {string} host - the receiving host
	 * @param {number} port - the receiving port
	 * @param {string} path - the OSC path
	 * @param {import('@companion-module/base').OSCSomeArguments} args - arguments to include
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
	 * @param {ServiceOscSender_CompanionOSCBundle[]} bundle - the packages to send
	 * @access public
	 */
	sendBundle(host, port, time, bundle) {
		if (this.server !== undefined && bundle !== undefined) {
			this.server.send(
				{
					// @ts-ignore
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
 * @typedef ServiceOscSender_CompanionOSCArgument
 * @property {string} type - 'f' = float | 'i' = int | 's' = string
 * @property {number|string} value - the argument's value
 */

/**
 * A full OSC package when sending a bundle
 * @typedef ServiceOscSender_CompanionOSCBundle
 * @property {string} address - the OSC path
 * @property {ServiceOscSender_CompanionOSCArgument[]} args - arguments to include
 */
export default ServiceOscSender
