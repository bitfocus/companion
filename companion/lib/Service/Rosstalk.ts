import { formatLocation, oldBankIndexToXY } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { ServiceApi } from './ServiceApi.js'
import { ServiceTcpBase, type TcpClientInfo } from './TcpBase.js'

/**
 * Class providing the Rosstalk api.
 *
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
 */
export class ServiceRosstalk extends ServiceTcpBase {
	readonly #serviceApi: ServiceApi

	/**
	 * The time to auto-release the button since this can only
	 * receive presses.  Default: <code>20 ms</code>
	 */
	readonly #releaseTime = 20

	constructor(serviceApi: ServiceApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/Rosstalk', 'rosstalk_enabled', null)

		this.#serviceApi = serviceApi

		this.port = 7788

		this.init()
	}

	/**
	 * Process an incoming message from a client
	 * @param _client - the client's tcp socket
	 * @param data - the incoming message part
	 * @access protected
	 */
	processIncoming(_client: TcpClientInfo, data: string | Buffer): void {
		// A chunk may contain multiple commands. They are usually newline separated, but some senders
		// terminate (or separate) commands with a null byte instead of, or as well as, a newline.
		for (const line of data.toString().split(/[\r\n\0]+/)) {
			this.#processCommand(line)
		}
	}

	#processCommand(rawLine: string): void {
		// Strip surrounding whitespace and control characters. Some senders frame commands with
		// control bytes that String.trim() leaves in place, which would break the anchored matches below.
		// eslint-disable-next-line no-control-regex -- deliberately stripping control-byte framing
		const line = rawLine.replace(/^[\s\x00-\x1f\x7f]+|[\s\x00-\x1f\x7f]+$/g, '').trim()

		// Ignore empty lines, e.g. the trailing part left by a command terminator
		if (!line) return

		// Use anchored matches, so that a command surrounded by garbage is not executed
		const matchCC = line.match(/^CC ([0-9]+):([0-9]+)$/)
		if (matchCC) {
			const xy = oldBankIndexToXY(parseInt(matchCC[2]))
			if (!xy) {
				this.logger.warn(`Invalid incoming RossTalk reference: ${line}`)
				return
			}

			this.#fireButtonPressAndRelease({
				pageNumber: parseInt(matchCC[1]),
				row: xy[1],
				column: xy[0],
			})
			return
		}

		const matchCCControl = line.match(/^CC ([0-9]+)\/([0-9]+)\/([0-9]+)$/)
		if (matchCCControl) {
			this.#fireButtonPressAndRelease({
				pageNumber: parseInt(matchCCControl[1]),
				row: parseInt(matchCCControl[2]),
				column: parseInt(matchCCControl[3]),
			})
			return
		}

		this.logger.warn(`Received unhandled RossTalk command: ${line}`)
	}

	#fireButtonPressAndRelease(location: ControlLocation): void {
		const controlId = this.#serviceApi.getControlIdAt(location)
		if (!controlId) {
			this.logger.info(`Ignore empty button ${formatLocation(location)}`)
			return
		}

		this.logger.info(`Push button ${formatLocation(location)}`)
		this.#serviceApi.pressControl(controlId, true, 'rosstalk')

		setTimeout(() => {
			this.#serviceApi.pressControl(controlId, false, 'rosstalk')
			this.logger.info(`Release button ${formatLocation(location)}`)
		}, this.#releaseTime)
	}
}
