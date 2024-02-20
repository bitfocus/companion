import { formatLocation, oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
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
	 * @param {import('../Registry.js').default} registry - the application core
	 */
	constructor(registry) {
		super(registry, 'rosstalk', 'Service/Rosstalk', 'rosstalk_enabled', null)

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param {import('./TcpBase.js').TcpClientInfo} _client - the client's tcp socket
	 * @param {string} data - the incoming message part
	 * @access protected
	 */
	processIncoming(_client, data) {
		data = data.toString()

		const matchCC = data.match(/CC ([0-9]+)\:([0-9]+)/)
		if (matchCC) {
			const xy = oldBankIndexToXY(parseInt(matchCC[2]))
			if (!xy) {
				this.logger.warn(`Invalid incoming RossTalk reference: ${data}`)
				return
			}

			this.#executeTrigger({
				pageNumber: parseInt(matchCC[1]),
				row: xy[1],
				column: xy[0],
			})
			return
		}

		const matchCCControl = data.match(/CC ([0-9]+)\/([0-9]+)\/([0-9]+)/)
		if (matchCCControl) {
			this.#executeTrigger({
				pageNumber: parseInt(matchCCControl[1]),
				row: parseInt(matchCCControl[2]),
				column: parseInt(matchCCControl[3]),
			})
			return
		}
	}

	/**
	 *
	 * @param {import('@companion-app/shared/Model/Common.js').ControlLocation} location
	 * @returns
	 */
	#executeTrigger(location) {
		const controlId = this.page.getControlIdAt(location)
		if (!controlId) {
			this.logger.info(`Ignore empty button ${formatLocation(location)}`)
			return
		}

		this.logger.info(`Push button ${formatLocation(location)}`)
		this.controls.pressControl(controlId, true, 'rosstalk')

		setTimeout(() => {
			this.controls.pressControl(controlId, false, 'rosstalk')
			this.logger.info(`Release button ${formatLocation(location)}`)
		}, this.releaseTime)
	}
}

export default ServiceRosstalk
