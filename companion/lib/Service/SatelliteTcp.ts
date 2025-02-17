import { ServiceBase } from './Base.js'
import net, { Socket } from 'net'
import LogController from '../Log/Controller.js'
import type { Registry } from '../Registry.js'
import { SatelliteSocketWrapper, ServiceSatelliteApi } from './SatelliteApi.js'

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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
export class ServiceSatelliteTcp extends ServiceBase {
	readonly #api: ServiceSatelliteApi

	#server: net.Server | undefined = undefined

	readonly #clients = new Set<Socket>()

	constructor(registry: Registry) {
		super(registry, 'Service/SatelliteTcp', null, null)

		this.#api = new ServiceSatelliteApi(registry)

		this.port = 16622

		this.init()
	}

	listen() {
		this.#server = net.createServer((socket) => {
			const name = socket.remoteAddress + ':' + socket.remotePort
			const socketLogger = LogController.createLogger(`Service/SatelliteTcp/${name}`)

			this.#clients.add(socket)

			socket.setTimeout(5000)
			socket.on('error', (e) => {
				this.#clients.delete(socket)

				socketLogger.silly('socket error:', e)
			})

			const { processMessage, cleanupDevices } = this.#api.initSocket(socketLogger, new SatelliteTcpSocket(socket))

			const doCleanup = () => {
				this.#clients.delete(socket)

				const count = cleanupDevices()
				socketLogger.info(`connection closed with ${count} connected surfaces`)

				socket.removeAllListeners('data')
				socket.removeAllListeners('close')
			}

			socket.on('timeout', () => {
				socketLogger.debug('socket timeout')
				socket.end()
				doCleanup()
			})

			socket.on('close', doCleanup)

			socket.on('data', (data) => processMessage(data.toString()))
		})
		this.#server.on('error', (e) => {
			this.logger.debug(`listen-socket error: ${e}`)
		})

		try {
			this.#server.listen(this.port)
		} catch (e) {
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
			} catch (e) {
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
