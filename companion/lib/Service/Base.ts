import type { UserConfigModel } from '@companion-app/shared/Model/UserConfigModel.js'
import LogController, { type Logger } from '../Log/Controller.js'
import type { DataUserConfig } from '../Data/UserConfig.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'

/**
 * Abstract class providing base functionality for services.
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
export abstract class ServiceBase {
	protected readonly logger: Logger

	protected readonly userconfig: DataUserConfig

	/**
	 * Flag to track if the module is currently enabled
	 */
	protected currentState: boolean = false
	/**
	 * The user config setting to track if the module should be enabled/disabled
	 */
	protected readonly enableConfig: keyof UserConfigModel | null
	/**
	 * Flag to track if the module is setup and ready to be enabled
	 */
	protected initialized: boolean = false
	/**
	 * The user config setting to track if the module should be enabled/disabled
	 */
	protected readonly portConfig: keyof UserConfigModel | null

	/**
	 * The port number to use for this service
	 */
	protected port: number = 0

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, 'module_name', 'module_path', enableConfig, portConfig)</code>.
	 * @param userconfig - the userconfig store
	 * @param debugNamespace - module path to be used in the debugger
	 * @param enableConfig - the key for the userconfig that sets if the module is enabled or disabled
	 * @param portConfig - the key for the userconfig that sets the service ports
	 */
	constructor(
		userconfig: DataUserConfig,
		debugNamespace: string,
		enableConfig: keyof UserConfigModel | null,
		portConfig: keyof UserConfigModel | null
	) {
		this.logger = LogController.createLogger(debugNamespace)
		this.userconfig = userconfig

		this.enableConfig = enableConfig
		this.portConfig = portConfig
	}

	/**
	 * Close the socket before deleting it
	 */
	protected abstract close(): void

	/**
	 * Kill the socket, if exists.
	 */
	protected disableModule(): void {
		if (this.currentState) {
			try {
				this.currentState = false
				this.close()
				this.logger.info(`Stopped listening on port ${this.port}`)
			} catch (e) {
				this.logger.silly(`Could not stop listening: ${stringifyError(e)}`)
			}
		}
	}

	/**
	 * Call to enable the socket if the module is initialized.
	 */
	protected enableModule(): void {
		if (this.initialized === true) {
			try {
				this.listen()
			} catch (e) {
				this.logger.error(`Error listening: ${stringifyError(e)}`)
			}
		}
	}

	/**
	 * Process a socket error and disable the module.
	 */
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	protected handleSocketError(e: any): void {
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
	 */
	protected init(): void {
		this.initialized = true

		if (!this.enableConfig || (this.enableConfig && this.userconfig.getKey(this.enableConfig) === true)) {
			this.enableModule()
		}
	}

	/**
	 * Start the service if it is not already running
	 */
	protected abstract listen(): void

	/**
	 * Stop and restart the module, if enabled.
	 */
	protected restartModule(): void {
		this.disableModule()

		if (!this.enableConfig || (this.enableConfig && this.userconfig.getKey(this.enableConfig) === true)) {
			this.enableModule()
		}
	}

	/**
	 * Process an updated userconfig value and enable/disable the module, if necessary.
	 * @param key - the saved key
	 * @param value - the saved value
	 */
	updateUserConfig(key: string, value: boolean | number | string): void {
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
