import net, { type Socket } from 'node:net'
import { StringDecoder } from 'node:string_decoder'
import type { DataUserConfig } from '../Data/UserConfig.js'
import LogController from '../Log/Controller.js'
import { GLOBAL_BIND_ADDRESS } from '../Resources/Constants.js'
import { ServiceBase } from './Base.js'
import { SatelliteSocketWrapper, type ServiceSatelliteApi } from './Satellite/SatelliteApi.js'

/**
 * Class providing the Satellite/Remote Surface api over tcp.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.2.0
 * @copyright 2022 Bitfocus AS
 * @license
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for Companion along with
 * this program.
 */
export class ServiceSatelliteTcp extends ServiceBase {
	readonly #api: ServiceSatelliteApi

	#server: net.Server | undefined = undefined

	readonly #clients = new Set<Socket>()

	/** The number of currently open satellite connections */
	get clientCount(): number {
		return this.#clients.size
	}

	constructor(api: ServiceSatelliteApi, userconfig: DataUserConfig) {
		super(userconfig, 'Service/SatelliteTcp', null, null)

		this.#api = api

		this.port = 16622

		this.init()
	}

	listen(): void {
		this.#server = net.createServer((socket) => {
			const name = socket.remoteAddress + ':' + socket.remotePort
			const socketLogger = LogController.createLogger(`Service/SatelliteTcp/${name}`)

			this.#clients.add(socket)

			let cleanupDevices: (() => number) | undefined

			// Anchor all teardown on the 'close' event, which node guarantees fires exactly once for
			// every socket. Registering it before initSocket() runs ensures the socket is always
			// removed from #clients (and any devices cleaned up) even if initialisation throws -
			// otherwise the set would grow without bound and leak memory.
			socket.on('close', () => {
				this.#clients.delete(socket)

				const count = cleanupDevices?.() ?? 0
				socketLogger.info(`connection closed with ${count} connected surfaces`)
			})

			socket.on('error', (e) => {
				socketLogger.silly('socket error:', e)
			})

			// Drop idle connections. Destroy rather than half-close (end), so that a peer which never
			// sends its own FIN still reaches 'close' and gets pruned from #clients.
			socket.setTimeout(5000, () => {
				socketLogger.debug('socket timeout')
				socket.destroy()
			})

			try {
				const api = this.#api.initSocket(socketLogger, new SatelliteTcpSocket(socket))
				cleanupDevices = api.cleanupDevices

				// Use a StringDecoder rather than data.toString() so multi-byte UTF-8 characters
				// split across TCP packet boundaries are decoded correctly.
				const decoder = new StringDecoder('utf8')
				socket.on('data', (data) => api.processMessage(decoder.write(data)))
			} catch (e) {
				socketLogger.error(`Failed to initialise satellite connection: ${e}`)
				socket.destroy()
			}
		})
		this.#server.on('error', (e) => {
			this.logger.debug(`listen-socket error: ${e}`)
		})

		try {
			this.#server.listen(this.port, GLOBAL_BIND_ADDRESS)
		} catch (_e) {
			this.logger.debug(`ERROR opening tcp port ${this.port} for companion satellite devices`)
		}
	}

	close(): void {
		if (this.#server) {
			this.#server.close()
			this.#server = undefined
		}

		// Disconnect all clients
		this.#clients.forEach((socket) => {
			try {
				socket.destroy()
			} catch (_e) {
				// Ignore failure
			}
		})
		this.#clients.clear()
	}
}

class SatelliteTcpSocket extends SatelliteSocketWrapper {
	readonly #socket: Socket

	get remoteAddress() {
		return this.#socket.remoteAddress
	}

	constructor(socket: Socket) {
		super()

		this.#socket = socket
	}

	destroy(): void {
		this.#socket.destroy()
	}

	protected override write(data: string): void {
		this.#socket.write(data)
	}
}
