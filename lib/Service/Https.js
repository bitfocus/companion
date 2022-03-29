import _https from 'https'
import fs from 'fs'
import ServiceBase from './Base.js'

/**
 * Class providing the HTTPS web interface.
 *
 * @extends ServiceBase
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
class ServiceHttps extends ServiceBase {
	/**
	 * The config ip to bind the service to
	 * @type {?string}
	 * @access protected
	 */
	bindIP
	/**
	 * The web application framework
	 * @type {?UIExpress}
	 * @access protected
	 */
	express
	/**
	 * The port to open the socket with.  Default: <code>8443</code>
	 * @type {number}
	 * @access protected
	 */
	port = 8443

	/**
	 * @param {Registry} registry - the core registry
	 * @param {UIExpress} express - the app framework
	 */
	constructor(registry, express) {
		super(registry, 'https', 'lib/Service/Https', 'https_enabled', 'https_port')
		this.express = express

		this.registry.on('http_rebind', (bindIP) => {
			this.bindIP = bindIP
			this.restartModule()
		})

		//Delay service start just to let everything sync up
		setTimeout(() => this.init(), 5000)
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 */
	listen() {
		if (this.server === undefined) {
			if (this.userconfig.getKey('https_cert_type') == 'external') {
				const priv = this.userconfig.getKey('https_ext_private_key')
				const cert = this.userconfig.getKey('https_ext_certificate')
				const chain = this.userconfig.getKey('https_ext_chain')

				if (priv != '' && cert != '') {
					try {
						const privateKey = fs.readFileSync(priv, 'utf8')
						this.log('debug', `Read private key file: ${priv}`)
						this.debug(`Read private key file: ${priv}`)

						const certificate = fs.readFileSync(cert, 'utf8')
						this.log('debug', `Read certificate file: ${cert}`)
						this.debug(`Read certificate file: ${cert}`)

						const credentials = {
							key: privateKey,
							cert: certificate,
						}

						if (chain != '' && fs.existsSync(chain)) {
							try {
								const ca = fs.readFileSync(chain, 'utf8')
								this.log('debug', `Read chain file: ${chain}`)
								this.debug(`Read chain file: ${chain}`)
								credentials.ca = ca
							} catch (e) {
								this.log('warn', `Couldn't read chain field: ${e}`)
								this.debug(`Couldn't read chain field: ${e}`)
							}
						}

						this.startServer(credentials)
					} catch (e) {
						this.log('error', `Could not start: ${e}`)
						this.debug(`Could not start: ${e}`)
					}
				} else {
					this.log('error', `Could not start: Private Key and/or Certificate files not set`)
					this.debug(`Could not start: Private Key and/or Certificate files not set`)
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
						this.log('error', `Could not start: ${e}`)
						this.debug(`Could not start: ${e}`)
					}
				} else {
					this.log('error', `Could not start: Incomplete or no self-signed certificate on file`)
					this.debug(`Could not start: Incomplete or no self-signed certificate on file`)
				}
			}
		}
	}

	/**
	 * Try to start the service with a certificate
	 * @param {Object} credentials - the certificate information
	 */
	startServer(credentials) {
		try {
			this.server = _https.createServer(credentials, this.express)
			this.server.on('error', this.handleSocketError.bind(this))
			this.server.listen(this.port, this.bindIP)
			this.io.enableHttps(this.server)

			this.server.log = () => {
				let args = Array.prototype.slice.call(arguments)
				args.unshift('log', 'https')
				this.debug(args)
			}

			this.currentState = true
			this.log('info', `Listening at https://${this.bindIP}:${this.port}`)
			this.debug(`Listening at https://${this.bindIP}:${this.port}`)
		} catch (e) {
			this.log('error', `Couldn't bind to port ${this.port}`)
			this.debug(`Couldn't bind to port ${this.port}: ${e}`)
			delete this.server
		}
	}

	/**
	 * Process an update userconfig value and enable/disable the module, if necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access protected
	 */
	updateUserConfig(key, value) {
		super.updateUserConfig(key, value)

		if (key.substring(0, 6) == 'https_' && key != this.enableConfig && key != this.portConfig) {
			this.restartModule()
		}
	}
}

export default ServiceHttps
