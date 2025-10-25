import { ServiceBase } from './Base.js'
import LogController from '../Log/Controller.js'
import type { AppInfo } from '../Registry.js'
import { SatelliteSocketWrapper, ServiceSatelliteApi } from './Satellite/SatelliteApi.js'
import { WebSocketServer, type WebSocket } from 'ws'
import type { DataUserConfig } from '../Data/UserConfig.js'
import type { SurfaceController } from '../Surface/Controller.js'

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
 */
export class ServiceSatelliteWebsocket extends ServiceBase {
	readonly #api: ServiceSatelliteApi

	#server: WebSocketServer | undefined = undefined

	constructor(appInfo: AppInfo, surfaceController: SurfaceController, userconfig: DataUserConfig) {
		super(userconfig, 'Service/SatelliteWebsocket', null, null)

		this.#api = new ServiceSatelliteApi(appInfo, surfaceController)

		this.port = 16623

		this.init()
	}

	listen(): void {
		if (this.#server === undefined) {
			try {
				this.#server = new WebSocketServer({
					port: this.port,
				})

				this.#server.on('error', (e) => {
					this.logger.debug(`listen-socket error: ${e}`)
				})

				this.#server.on('connection', (socket, req) => {
					const name = req.socket.remoteAddress + ':' + req.socket.remotePort
					const socketLogger = LogController.createLogger(`Service/SatelliteWs/${name}`)

					let lastReceived = Date.now()

					// socket.setTimeout(5000)
					socket.on('error', (e) => {
						socketLogger.silly('socket error:', e)
					})

					const { processMessage, cleanupDevices } = this.#api.initSocket(
						socketLogger,
						new SatelliteWSSocket(socket, req.socket.remoteAddress)
					)

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

						// eslint-disable-next-line @typescript-eslint/no-base-to-string
						processMessage(data.toString())
					})
				})
			} catch (_e) {
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

class SatelliteWSSocket extends SatelliteSocketWrapper {
	readonly #socket: WebSocket
	readonly remoteAddress: string | undefined

	constructor(socket: WebSocket, remoteAddress: string | undefined) {
		super()

		this.#socket = socket
		this.remoteAddress = remoteAddress
	}

	destroy(): void {
		this.#socket.terminate()
	}

	protected override write(data: string): void {
		this.#socket.send(data)
	}
}
