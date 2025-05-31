import _https from 'https'
import fs from 'fs'
import { ServiceBase } from './Base.js'
import type { UIExpress } from '../UI/Express.js'
import type { UIHandler } from '../UI/Handler.js'
import type { DataUserConfig } from '../Data/UserConfig.js'

/**
 * Class providing the HTTPS web interface.
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
export class ServiceHttps extends ServiceBase {
	/**
	 * The config ip to bind the service to
	 */
	#bindIP: string | undefined

	/**
	 * The web application framework
	 */
	readonly #express: UIExpress
	readonly #io: UIHandler

	#server: _https.Server | undefined = undefined

	constructor(userconfig: DataUserConfig, express: UIExpress, io: UIHandler) {
		super(userconfig, 'Service/Https', 'https_enabled', 'https_port')
		this.#express = express
		this.#io = io

		this.port = 8443

		//Delay service start just to let everything sync up
		setTimeout(() => this.init(), 5000)
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.portConfig) {
			this.port = Number(this.userconfig.getKey(this.portConfig))
		}

		if (this.#server === undefined) {
			if (this.userconfig.getKey('https_cert_type') == 'external') {
				const priv = this.userconfig.getKey('https_ext_private_key')
				const cert = this.userconfig.getKey('https_ext_certificate')
				const chain = this.userconfig.getKey('https_ext_chain')

				if (priv != '' && cert != '') {
					try {
						const privateKey = fs.readFileSync(priv, 'utf8')
						this.logger.debug(`Read private key file: ${priv}`)
						this.logger.silly(`Read private key file: ${priv}`)

						const certificate = fs.readFileSync(cert, 'utf8')
						this.logger.debug(`Read certificate file: ${cert}`)
						this.logger.silly(`Read certificate file: ${cert}`)

						const credentials: ServiceHttpsCredentials = {
							key: privateKey,
							cert: certificate,
						}

						if (chain != '' && fs.existsSync(chain)) {
							try {
								const ca = fs.readFileSync(chain, 'utf8')
								this.logger.debug(`Read chain file: ${chain}`)
								this.logger.silly(`Read chain file: ${chain}`)
								credentials.ca = ca
							} catch (e) {
								this.logger.warn(`Couldn't read chain field: ${e}`)
								this.logger.silly(`Couldn't read chain field: ${e}`)
							}
						}

						this.startServer(credentials)
					} catch (e) {
						this.logger.error(`Could not start: ${e}`)
						this.logger.silly(`Could not start: ${e}`)
					}
				} else {
					this.logger.error(`Could not start: Private Key and/or Certificate files not set`)
					this.logger.silly(`Could not start: Private Key and/or Certificate files not set`)
				}
			} else {
				const priv = this.userconfig.getKey('https_self_cert_private')
				const cert = this.userconfig.getKey('https_self_cert')

				if (priv != '' && cert != '') {
					try {
						const credentials = {
							key: priv,
							cert: cert,
						}

						this.startServer(credentials)
					} catch (e) {
						this.logger.error(`Could not start: ${e}`)
						this.logger.silly(`Could not start: ${e}`)
					}
				} else {
					this.logger.error(`Could not start: Incomplete or no self-signed certificate on file`)
					this.logger.silly(`Could not start: Incomplete or no self-signed certificate on file`)
				}
			}
		}
	}

	close() {
		if (this.#server) {
			this.#server.close()
			this.#server = undefined
		}
	}

	/**
	 * Try to start the service with a certificate
	 * @param credentials - the certificate information
	 */
	startServer(credentials: ServiceHttpsCredentials): void {
		try {
			this.#server = _https.createServer(credentials, this.#express.app)
			this.#server.on('error', this.handleSocketError.bind(this))
			this.#server.listen(this.port, this.#bindIP ?? undefined)
			this.#io.bindToHttps(this.#server)

			// this.server.log = (...args) => {
			// 	this.logger.silly('log', 'https', ...args)
			// }

			this.currentState = true
			this.logger.info(`Listening at https://${this.#bindIP}:${this.port}`)
			this.logger.silly(`Listening at https://${this.#bindIP}:${this.port}`)
		} catch (e) {
			this.logger.error(`Couldn't bind to port ${this.port}`)
			this.logger.silly(`Couldn't bind to port ${this.port}: ${e}`)
			this.#server = undefined
		}
	}

	updateBindIp(bindIp: string): void {
		this.#bindIP = bindIp
		this.restartModule()
	}

	/**
	 * Process an update userconfig value and enable/disable the module, if necessary.
	 */
	updateUserConfig(key: string, value: boolean | number | string): void {
		super.updateUserConfig(key, value)

		if (key.substring(0, 6) == 'https_' && key != this.enableConfig && key != this.portConfig) {
			this.restartModule()
		}
	}
}

interface ServiceHttpsCredentials {
	key: string
	cert: string
	ca?: string
}
