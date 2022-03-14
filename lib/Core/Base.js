const debug = require('debug')

//const BankController = require('../Bank/Controller')
//const GraphicsController = require('../Graphics/Controller')
//const GraphicsPreview = require('../Graphics/Preview')
//const DataCache = require('../Data/Cache')
//const DataDatabase = require('../Data/Database')
//const DataUserConfig = require('../Data/UserConfig')
//const InstanceController = require('../Instance/Controller')
//const PageController = require('../Page/Controller')
//const Registry = require('../Registry')
//const ServiceController = require('../Service/Controller')
//const SurfaceController = require('../Surface/Controller')
//const TriggersController = require('../Triggers/Controller')
//const UIHandler = require('../UI/Handler')

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
class CoreBase {
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = null
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
	 * using <code>super(registry, 'module_name', 'module_path')</code>.
	 * @param {Registry} registry - the application core
	 * @param {string} logSource - module name to be used in UI logs
	 * @param {string} debugNamespace - module path to be used in the debugger
	 */
	constructor(registry, logSource, debugNamespace) {
		this.registry = registry
		this.logSource = logSource
		this.debug = debug(debugNamespace)
		this.debug('loading module')
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
	 * The disk cache library
	 * @type {DataCache}
	 * @access protected
	 * @readonly
	 */
	get cache() {
		return this.registry.cache
	}

	/**
	 * Change the debug path
	 * @param {string} newNamespace - the new path to use in the debugger
	 * @access protected
	 */
	changeDebug(newNamespace) {
		this.debug = debug(newNamespace)
	}

	/**
	 * The core database library
	 * @type {DataDatabase}
	 * @access protected
	 * @readonly
	 */
	get db() {
		return this.registry.db
	}

	/**
	 * The core graphics controller
	 * @type {GraphicsController}
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
	 * @type {UIHandler}
	 * @access protected
	 * @readonly
	 */
	get io() {
		return this.registry.io
	}

	/**
	 * Send a log message to the UI
	 * @param {string} level - 'debug' | 'info' | 'warn' | 'error'
	 * @param {string} message - the message to print
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
	 * The core page controller
	 * @type {GraphicsPreview}
	 * @access protected
	 * @readonly
	 */
	get preview() {
		return this.registry.preview
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
	 * The core device controller
	 * @type {SurfaceController}
	 * @access protected
	 * @readonly
	 */
	get surfaces() {
		return this.registry.surfaces
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
	 * The core schedule controller
	 * @type {TriggersController}
	 * @access protected
	 * @readonly
	 */
	get triggers() {
		return this.registry.triggers
	}

	/**
	 * The core user config manager
	 * @type {DataUserConfig}
	 * @access protected
	 * @readonly
	 */
	get userconfig() {
		return this.registry.userconfig
	}

	/**
	 * The internal module
	 * @type {InternalController}
	 * @access protected
	 * @readonly
	 */
	get internalModule() {
		return this.registry.internalModule
	}
}

module.exports = CoreBase
