import { stringifyError } from '@companion-app/shared/Stringify.js'
import { ServiceBase } from './Base.js'
import OSC, { type OscReceivedMessage } from 'osc'

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
 */
export abstract class ServiceOscBase extends ServiceBase {
	protected server: OSC.UDPPort | undefined = undefined

	/**
	 * Start the service if it is not already running
	 */
	protected listen(): void {
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
			} catch (e) {
				this.logger.error(`Could not launch: ${stringifyError(e)}`)
			}
		}
	}

	protected close(): void {
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
