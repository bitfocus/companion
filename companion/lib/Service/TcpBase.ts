import net, { type Socket } from 'node:net'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { GLOBAL_BIND_ADDRESS } from '../Resources/Constants.js'
import { ServiceBase } from './Base.js'

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
/**
 * Maximum length a single line (command) may reach in the receive buffer before the connection is
 * dropped. This bounds per-connection memory and closes off a "buffer bomb" where a client streams
 * data forever without ever sending a newline. 2MB is far more than any line-based tcp api needs.
 */
export const MAX_TCP_RECEIVE_BUFFER = 2 * 1024 * 1024

export abstract class ServiceTcpBase extends ServiceBase {
	protected server: net.Server | undefined = undefined

	/**
	 * This stored client sockets
	 */
	protected readonly clients = new Set<Socket>()

	/**
	 * Start the service if it is not already running
	 */
	protected listen(): void {
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

				this.server.listen(this.port, GLOBAL_BIND_ADDRESS)
				this.currentState = true
				this.logger.info('Listening on port ' + this.port)
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

		this.clients.forEach((socket) => {
			try {
				socket.destroy()
			} catch (_e) {
				// Ignore failure
			}
		})
		this.clients.clear()
	}

	/**
	 * Process an incoming message from a client
	 */
	protected abstract processIncoming(client: TcpClientInfo, chunk: string | Buffer): void

	/**
	 * Drop the connection if the client's receive buffer has grown beyond the maximum line length,
	 * to guard against a "buffer bomb" (data streamed forever without a newline). Subclasses that
	 * accumulate into `receiveBuffer` should call this after consuming any complete lines.
	 * @returns true if the connection was dropped
	 */
	protected enforceReceiveBufferLimit(client: TcpClientInfo): boolean {
		if (client.receiveBuffer.length > MAX_TCP_RECEIVE_BUFFER) {
			this.logger.warn(`Closing connection ${client.name}: line exceeded ${MAX_TCP_RECEIVE_BUFFER} bytes`)
			client.receiveBuffer = ''
			client.socket.destroy()
			return true
		}
		return false
	}
}

export interface TcpClientInfo {
	name: string
	receiveBuffer: string
	socket: Socket
}
