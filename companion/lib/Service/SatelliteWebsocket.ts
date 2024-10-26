import { ServiceBase } from './Base.js'
import LogController from '../Log/Controller.js'
import type { Registry } from '../Registry.js'
import { ServiceSatelliteApi } from './SatelliteApi.js'
import { WebSocketServer } from 'ws'

/**
 * Class providing the Satellite/Remote Surface api over websockets.
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
export class ServiceSatelliteWebsocket extends ServiceBase {
	readonly #api: ServiceSatelliteApi

	#server: WebSocketServer | undefined = undefined

	constructor(registry: Registry) {
		super(registry, 'Service/SatelliteWebsocket', null, null)

		this.#api = new ServiceSatelliteApi(registry)

		this.port = 16623

		this.init()
	}

	listen() {
		if (this.#server === undefined) {
			try {
				this.#server = new WebSocketServer({
					port: this.port,
				})

				this.#server.on('error', (e) => {
					this.logger.debug(`listen-socket error: ${e}`)
				})

				this.#server.on('connection', (socket) => {
					// @ts-expect-error This works but isn't in the types.. TODO: verify this
					const name = socket.remoteAddress + ':' + socket.remotePort
					const socketLogger = LogController.createLogger(`Service/SatelliteWs/${name}`)

					let lastReceived = Date.now()

					// socket.setTimeout(5000)
					socket.on('error', (e) => {
						socketLogger.silly('socket error:', e)
					})

					const { processMessage, cleanupDevices } = this.#api.initSocket(socketLogger, {
						// @ts-expect-error The property exists but not in the types
						remoteAddress: socket.remoteAddress,
						destroy: () => socket.terminate(),
						write: (data) => socket.send(data),
					})

					const timeoutCheck = setInterval(() => {
						if (lastReceived < Date.now() - 5000) {
							socketLogger.debug('socket timeout')
							socket.terminate()
							doCleanup()
						}
					}, 3000)

					const doCleanup = () => {
						const count = cleanupDevices()
						socketLogger.info(`connection closed with ${count} connected surfaces`)

						socket.removeAllListeners('data')
						socket.removeAllListeners('close')

						clearInterval(timeoutCheck)
					}

					socket.on('close', doCleanup)

					socket.on('message', (data) => {
						lastReceived = Date.now()

						processMessage(data.toString())
					})
				})
			} catch (e) {
				this.logger.debug(`ERROR opening ws port ${this.port} for companion satellite devices`)
			}
		}
	}

	close(): void {
		if (this.#server) {
			this.logger.info('Shutting down')

			for (const client of this.#server.clients) {
				client.terminate()
			}

			this.#server.close()
			this.#server = undefined
		}
	}
}
