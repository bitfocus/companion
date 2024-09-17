import { ServiceBase } from './Base.js'
import dgram from 'dgram'

/**
 * Abstract class providing base functionality for UDP services.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
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
export abstract class ServiceUdpBase extends ServiceBase {
	protected server: dgram.Socket | undefined

	/**
	 * Start the service if it is not already running
	 */
	protected listen() {
		if (this.portConfig) {
			this.port = Number(this.userconfig.getKey(this.portConfig))
		}

		if (this.server === undefined) {
			try {
				this.server = dgram.createSocket('udp4', this.processIncoming.bind(this))

				this.server.on('error', (err) => {
					this.logger.silly('UDP server error:', err.stack)
					//this.server.close();
				})

				this.server.bind(this.port)
				this.currentState = true
				this.logger.info('Listening on port ' + this.port)
			} catch (e: any) {
				this.logger.error(`Could not launch: ${e.message}`)
			}
		}
	}

	protected close() {
		if (this.server) {
			this.server.close()
			this.server = undefined
		}
	}

	/**
	 * Process an incoming message from a remote
	 * @param data - the incoming message
	 * @param remote - remote address information
	 */
	protected abstract processIncoming(data: Buffer, remote: DgramRemoteInfo): void
}

export interface DgramRemoteInfo {
	address: string
	family: string
	port: number
	size: number
}
