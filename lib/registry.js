const BankController = require('./Bank/Controller')
const DB = require('./Data/Database')
const DeviceController = require('./Device/Controller')
const Graphics = require('./Graphics/Graphics')
const ImportExport = require('./Data/ImportExport')
const InstanceController = require('./Instance/Controller')
const InterfaceClient = require('./Interface/Client')
const InterfaceServer = require('./Interface/Server')
const PageController = require('./Page/Controller')
const Preset = require('./Instance/Preset')
const Preview = require('./Graphics/Preview')
const ScheduleController = require('./Schedule/Controller')
const ServiceController = require('./Service/Controller')
const UserConfig = require('./Data/UserConfig')
const Variable = require('./Instance/Variable')

/**
 * The core controller that sets up all the controllers needed
 * for the app.
 *
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @since 2.3.0
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
class Registry {
	/**
	 * The curent file/db verison number
	 * @type {number}
	 * @access public
	 * @static
	 */
	static FileVersion = 2

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Registry')

	/**
	 * Set up the registry
	 * @param {App} app - the application launcher
	 */
	constructor(app) {
		this.app = app
		this.system = app.system
		this.config = app.config
		this.appRoot = require('app-root-path')
		this.debug('launching core modules')

		this.server = new InterfaceServer(this)
		this.io = new InterfaceClient(this)
		this.log = this.io.log
		this.db = new DB(this)
		this.userconfig = new UserConfig(this)
		this.page = new PageController(this)
		this.variable = new Variable(this)
		this.schedule = new ScheduleController(this)
		this.bank = new BankController(this)
		this.graphics = new Graphics(this)
		this.deviceController = new DeviceController(this)
		this.preview = new Preview(this)
		this.instance = new InstanceController(this)
		this.service = new ServiceController(this)
		this.loadsave = new ImportExport(this)
		this.preset = new Preset(this)
	}

	/**
	 * @returns {string} the application's root file path
	 * @access public
	 */
	getAppRoot() {
		return this.appRoot
	}

	/**
	 * @returns {string} the folder path to the config/db
	 * @access public
	 */
	getCfgDir() {
		return this.config.getCfgDir()
	}

	/**
	 * @returns {number} the current version number for the db and file import/export
	 * @access public
	 */
	getFileVersion() {
		return Registry.FileVersion
	}

	/**
	 * Execute a graceful exit
	 * @access public
	 */
	quit() {
		this.deviceController.quit()
		this.db.saveImmediate()

		this.emit('instance_getall', (instances, active) => {
			try {
				for (var key in active) {
					if (instances[key].label !== 'internal') {
						try {
							active[key].destroy()
						} catch (e) {
							console.log('Could not destroy', instances[key].label)
						}
					}
				}
			} catch (e) {
				console.log('Could not destroy all instances')
			}
		})
	}
}

exports = module.exports = Registry
