import { ServiceBase } from './Base.js'
import net, { Socket } from 'net'

/**
 * Abstract class providing base functionality for TCP services.
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
export abstract class ServiceTcpBase extends ServiceBase {
	protected server: net.Server | undefined = undefined

	/**
	 * This stored client sockets
	 */
	protected readonly clients = new Set<Socket>()

	/**
	 * Start the service if it is not already running
	 */
	protected listen() {
		if (this.portConfig) {
			this.port = this.userconfig.getKey(this.portConfig)
		}

		if (this.server === undefined) {
			try {
				this.server = net.createServer((client) => {
					const clientInfo: TcpClientInfo = {
						name: client.remoteAddress + ':' + client.remotePort,
						receiveBuffer: '',
						socket: client,
					}

					client.on('end', () => {
						this.clients.delete(client)
						this.logger.debug('Client disconnected: ' + clientInfo.name)
					})

					client.on('error', () => {
						this.clients.delete(client)
						this.logger.error('Client errored/died: ' + clientInfo.name)
					})

					this.clients.add(client)

					this.logger.debug('Client connected: ' + clientInfo.name)

					client.on('data', this.processIncoming.bind(this, clientInfo))
				})

				this.server.on('error', this.handleSocketError.bind(this))

				this.server.listen(this.port)
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

		this.clients.forEach((socket) => {
			try {
				socket.destroy()
			} catch (e) {
				// Ignore failure
			}
		})
		this.clients.clear()
	}

	/**
	 * Process an incoming message from a client
	 */
	protected abstract processIncoming(client: TcpClientInfo, chunk: string): void
}

export interface TcpClientInfo {
	name: string
	receiveBuffer: string
	socket: Socket
}
