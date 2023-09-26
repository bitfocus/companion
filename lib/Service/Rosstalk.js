import { CreateBankControlId } from '../Shared/ControlId.js'
import ServiceTcpBase from './TcpBase.js'

/**
 * Class providing the Rosstalk api.
 *
 * @extends ServiceTcpBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Justin Osborne <justin@eblah.com>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.1.1
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
class ServiceRosstalk extends ServiceTcpBase {
	/**
	 * The port to open the socket with.  Default: <code>7788</code>
	 * @type {number}
	 * @access protected
	 */
	port = 7788
	/**
	 * The time to auto-release the button since this can only
	 * receive presses.  Default: <code>20 ms</code>
	 * @type {number}
	 * @access protected
	 */
	releaseTime = 20

	/**
	 * @param {Registry} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'rosstalk', 'Service/Rosstalk', 'rosstalk_enabled')

		this.releaseTime = 20 // ms to send button release

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param {Socket} client - the client's tcp socket
	 * @param {string} data - the incoming message part
	 * @access protected
	 */
	processIncoming(client, data) {
		data = data.toString()
		// Type, bank/page, CC/bnt number
		const match = data.match(/(CC) ([0-9]*)\:([0-9]*)/)
		if (!match) {
			this.logger.warn(`Invalid incoming RossTalk command: ${data}`)
			return
		}

		if (match[1] === 'CC') {
			let page = parseInt(match[2])
			let bank = parseInt(match[3])

			const controlId = CreateBankControlId(page, bank)
			this.logger.info(`Push button ${page}.${bank}`)
			this.controls.pressControl(controlId, true, 'rosstalk')

			setTimeout(() => {
				this.controls.pressControl(controlId, false, 'rosstalk')
				this.logger.info(`Release button ${page}.${bank}`)
			}, this.releaseTime)
		}
	}
}

export default ServiceRosstalk
