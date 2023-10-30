import CoreBase from '../Core/Base.js'

/**
 * Abstract class providing base functionality for services.
 *
 * @extends CoreBase
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @author Julian Waller <me@julusian.co.uk>
 * @since 2.3.0
 * @abstract
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
class ServiceBase extends CoreBase {
	/**
	 * Flag to track if the module is currently enabled
	 * @type {boolean}
	 * @access protected
	 */
	currentState = false
	/**
	 * The user config setting to track if the module should be enabled/disabled
	 * @type {?string}
	 * @access protected
	 */
	enableConfig
	/**
	 * Flag to track if the module is setup and ready to be enabled
	 * @type {boolean}
	 * @access protected
	 */
	initialized = false
	/**
	 * The user config setting to track if the module should be enabled/disabled
	 * @type {?string}
	 * @access protected
	 */
	portConfig

	/**
	 * The port number to use for this service
	 * @type {number}
	 * @access protected
	 */
	port = 0

	/**
	 * Server handle
	 * @type {unknown | undefined}
	 * @access protected
	 */
	server

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, 'module_name', 'module_path', enableConfig, portConfig)</code>.
	 * @param {import('../Registry.js').default} registry - the core registry
	 * @param {string} logSource - module name to be used in UI logs
	 * @param {string} debugNamespace - module path to be used in the debugger
	 * @param {?string} enableConfig - the key for the userconfig that sets if the module is enabled or disabled
	 * @param {?string} portConfig - the key for the userconfig that sets the service ports
	 */
	constructor(registry, logSource, debugNamespace, enableConfig, portConfig) {
		super(registry, logSource, debugNamespace)

		this.enableConfig = enableConfig
		this.portConfig = portConfig
	}

	/**
	 * Close the socket before deleting it
	 * @access protected
	 */
	close() {
		// @ts-ignore
		this.server?.close()
	}

	/**
	 * Kill the socket, if exists.
	 * @access protected
	 */
	disableModule() {
		if (this.server) {
			try {
				this.currentState = false
				this.close()
				this.logger.info(`Stopped listening on port ${this.port}`)
				delete this.server
			} catch (/** @type {any} */ e) {
				this.logger.silly(`Could not stop listening: ${e.message}`)
			}
		}
	}

	/**
	 * Call to enable the socket if the module is initialized.
	 * @access protected
	 */
	enableModule() {
		if (this.initialized === true) {
			try {
				this.listen()
			} catch (/** @type {any} */ e) {
				this.logger.error(`Error listening: ${e.message}`)
			}
		}
	}

	/**
	 * Process a socket error and disable the module.
	 * @param {any} e - the error
	 * @access protected
	 */
	handleSocketError(e) {
		let message
		let disable = false

		switch (e.code) {
			case 'EADDRINUSE':
				message = `Port ${this.port} already in use.`
				disable = true
				break
			case 'EACCES':
				message = `Access to port ${this.port} denied.`
				disable = true
				break
			default:
				message = e.message
		}

		this.logger.error(message)

		if (disable === true) {
			this.disableModule()
		}
	}

	/**
	 * Initialize and enable the socket if defaults allow.
	 * @access protected
	 */
	init() {
		this.initialized = true

		if (!this.enableConfig || (this.enableConfig && this.userconfig.getKey(this.enableConfig) === true)) {
			this.enableModule()
		}
	}

	/**
	 * Start the service if it is not already running
	 * @access protected
	 * @abstract
	 */
	listen() {}

	/**
	 * Stop and restart the module, if enabled.
	 * @access protected
	 */
	restartModule() {
		this.disableModule()

		if (!this.enableConfig || (this.enableConfig && this.userconfig.getKey(this.enableConfig) === true)) {
			this.enableModule()
		}
	}

	/**
	 * Process an updated userconfig value and enable/disable the module, if necessary.
	 * @param {string} key - the saved key
	 * @param {(boolean|number|string)} value - the saved value
	 * @access public
	 */
	updateUserConfig(key, value) {
		if (this.enableConfig !== undefined && key == this.enableConfig) {
			if (this.currentState == false && value == true) {
				this.enableModule()
			} else if (this.currentState == true && value == false) {
				this.disableModule()
			}
		} else if (this.portConfig !== undefined && key == this.portConfig) {
			if (this.currentState == true) {
				this.disableModule()
				this.port = Number(value)
				this.enableModule()
			} else {
				this.port = Number(value)
			}
		}
	}
}

export default ServiceBase
