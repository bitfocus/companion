import { EventEmitter } from 'events'

/**
 * Abstract class to be extended by most core classes.  Provides access to the
 * {@link Registry} and other core modules.
 *
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
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
class CoreBase extends EventEmitter {
	/**
	 * The application core
	 * @type {import('../Registry.js').default}
	 * @access protected
	 */
	registry

	/**
	 * The logger for this class
	 * @type {import('winston').Logger}
	 * @access protected
	 */
	logger

	/**
	 * This needs to be called in the extending class
	 * using <code>super(registry, 'module_name', 'module_path')</code>.
	 * @param {import('../Registry.js').default} registry - the application core
	 * @param {string} _logSource - module name to be used in UI logs
	 * @param {string} debugNamespace - module path to be used in the debugger
	 */
	constructor(registry, _logSource, debugNamespace) {
		super()

		this.registry = registry

		this.logger = this.registry.log.createLogger(debugNamespace)
	}

	/**
	 * The core controls controller
	 * @type {import('../Controls/Controller.js').default}
	 * @access protected
	 * @readonly
	 */
	get controls() {
		return this.registry.controls
	}

	/**
	 * The core database library
	 * @type {import('../Data/Database.js').default}
	 * @access protected
	 * @readonly
	 */
	get db() {
		return this.registry.db
	}

	/**
	 * The core graphics controller
	 * @type {import('../Graphics/Controller.js').default}
	 * @access protected
	 * @readonly
	 */
	get graphics() {
		return this.registry.graphics
	}

	/**
	 * The core instance controller
	 * @type {import('../Instance/Controller.js').default}
	 * @access protected
	 * @readonly
	 */
	get instance() {
		return this.registry.instance
	}

	/**
	 * The core interface client
	 * @type {import('../UI/Handler.js').default}
	 * @access protected
	 * @readonly
	 */
	get io() {
		return this.registry.io
	}

	/**
	 * The core page controller
	 * @type {import('../Page/Controller.js').default}
	 * @access protected
	 * @readonly
	 */
	get page() {
		return this.registry.page
	}

	/**
	 * The core page controller
	 * @type {import('../Graphics/Preview.js').default}
	 * @access protected
	 * @readonly
	 */
	get preview() {
		return this.registry.preview
	}

	/**
	 * The core service controller
	 * @type {import('../Service/Controller.js').default}
	 * @access protected
	 * @readonly
	 */
	get services() {
		return this.registry.services
	}

	/**
	 * The core device controller
	 * @type {import('../Surface/Controller.js').default}
	 * @access protected
	 * @readonly
	 */
	get surfaces() {
		return this.registry.surfaces
	}

	/**
	 * The core user config manager
	 * @type {import('../Data/UserConfig.js').default}
	 * @access protected
	 * @readonly
	 */
	get userconfig() {
		return this.registry.userconfig
	}

	/**
	 * The internal module
	 * @type {import('../Internal/Controller.js').default}
	 * @access protected
	 * @readonly
	 */
	get internalModule() {
		return this.registry.internalModule
	}
}

export default CoreBase
