/**
 * Abstract class to be extended by most core classes.  Provides access to the
 * {@link Registry} and other core modules.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
 * @since 2.3.0
 * @abstract
 * @copyright 2021 Bitfocus AS
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
class CoreBase {
	/**
	 * The module name to use in UI logs
	 * @type {string}
	 * @access protected
	 */
	logSource = null
	/**
	 * The application core
	 * @type {Registry}
	 * @access protected
	 */
	registry = null

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, 'module_name')</code>.
	 * @param {Registry} registry - the core registry
	 * @param {string} logSource - module name to be used in UI logs
	 * @throws Will throw an error if the extending class has not declared <code>debug</code>
	 */
	constructor(registry, logSource) {
		this.registry = registry
		this.logSource = logSource

		if (this.debug === undefined) {
			throw `${logSource}: debugger not defined`
		}
	}

	/**
	 * The core bank controller
	 * @type {BankController}
	 * @access protected
	 * @readonly
	 */
	get bank() {
		return this.registry.bank
	}

	/**
	 * The core config handler
	 * @type {Config}
	 * @access protected
	 * @readonly
	 */
	get config() {
		return this.registry.config
	}

	/**
	 * The core database library
	 * @type {Database}
	 * @access protected
	 * @readonly
	 */
	get db() {
		return this.registry.db
	}

	/**
	 * The core device controller
	 * @type {DeviceController}
	 * @access protected
	 * @readonly
	 */
	get devices() {
		return this.registry.devices
	}

	/**
	 * The core graphics controller
	 * @type {Graphics}
	 * @access protected
	 * @readonly
	 */
	get graphics() {
		return this.registry.graphics
	}

	/**
	 * The core instance controller
	 * @type {InstanceController}
	 * @access protected
	 * @readonly
	 */
	get instance() {
		return this.registry.instance
	}

	/**
	 * The core interface client
	 * @type {InterfaceClient}
	 * @access protected
	 * @readonly
	 */
	get io() {
		this.registry.io
	}

	/**
	 * Send a log message to the UI
	 * @param {string} level - 'debug' | 'info' | 'warn' | 'error'
	 * @param {atring} message - the message to print
	 * @access protected
	 */
	log(level, message) {
		try {
			this.registry.log.add(this.logSource, level, message)
		} catch (e) {
			this.debug(`${level}: ${message}`)
		}
	}

	/**
	 * The core page controller
	 * @type {PageController}
	 * @access protected
	 * @readonly
	 */
	get page() {
		return this.registry.page
	}

	/**
	 * The core schedule controller
	 * @type {ScheduleController}
	 * @access protected
	 * @readonly
	 */
	get schedule() {
		return this.registry.schedule
	}

	/**
	 * The core service controller
	 * @type {ServiceController}
	 * @access protected
	 * @readonly
	 */
	get services() {
		return this.registry.services
	}

	/**
	 * The modules' event emitter interface
	 * @type {EventEmitter}
	 * @access protected
	 * @readonly
	 */
	get system() {
		return this.registry.system
	}

	/**
	 * The core user config manager
	 * @type {UserConfig}
	 * @access protected
	 * @readonly
	 */
	get userconfig() {
		return this.registry.userconfig
	}
}

exports = module.exports = CoreBase
