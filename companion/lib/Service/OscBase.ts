import { ServiceBase } from './Base.js'
import OSC, { OscReceivedMessage } from 'osc'

/**
 * Abstract class providing base functionality for OSC services.
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
export abstract class ServiceOscBase extends ServiceBase {
	protected server: OSC.UDPPort | undefined = undefined

	/**
	 * Start the service if it is not already running
	 */
	protected listen() {
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
	 * Process an incoming message from a client
	 * @param message - the incoming message part
	 */
	protected abstract processIncoming(message: OscReceivedMessage): void
}
