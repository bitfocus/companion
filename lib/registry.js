const BankController = require('./Bank/Controller')
const Config = require('./Data/Config')
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

const EventEmitter = require('events')
const fs = require('fs')
const mkdirp = require('mkdirp')
const stripAnsi = require('strip-ansi')

if (process.env.DEVELOPER !== undefined) {
	process.env['DEBUG'] = '*,-websocket*,-express*,-engine*,-socket.io*,-send*,-db,-NRC*,-follow-redirects'
}

global.MAX_BUTTONS = 32
global.MAX_BUTTONS_PER_ROW = 8

/**
 * The core controller that sets up all the controllers needed
 * for the app.
 *
 * @extends EventEmitter
 * @author Håkon Nessjøen <haakon@bitfocus.io>
 * @author Keith Rocheck <keith.rocheck@gmail.com>
 * @author William Viker <william@bitfocus.io>
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
class Registry extends EventEmitter {
	/**
	 * The application's build number
	 * @type {string}
	 * @access protected
	 */
	buildNumber = ''

	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('Registry')

	/**
	 * The log to file buffer
	 * @type {Array.<string>}
	 * @access protected
	 */
	logbuffer = []

	/**
	 * Logging enabled flag
	 * @type {boolean}
	 * @access protected
	 */
	logwriting = false

	/**
	 * The application's package information
	 * @type {Object}
	 * @access protected
	 */
	pkgInfo = require('./package.json')

	/**
	 * The skeleton's application information
	 * @type {Object}
	 * @access public
	 */
	skeletonInfo = {}

	/**
	 * The event emitter used to interface with the modules
	 * @class System
	 * @extends EventEmitter
	 */
	system = new EventEmitter()

	/** */
	constructor() {
		super()

		this.debug('starting registry')

		this.buildNumber = fs
			.readFileSync(__dirname + '/BUILD')
			.toString()
			.trim()

		this.skeletonInfo = {
			appName: this.appName,
			appVersion: this.appVersion,
			appBuild: this.appBuild,
			appStatus: 'Starting',
		}
	}

	/**
	 * The application's build number
	 * @type {string}
	 * @access public
	 * @readonly
	 */
	get appBuild() {
		return this.buildNumber.replace(/-*master-*/, '').replace(/^-/, '')
	}

	/**
	 * The application's name
	 * @type {string}
	 * @access public
	 * @readonly
	 */
	get appName() {
		return this.pkgInfo.description
	}

	/**
	 * The application's root file path
	 * @type {string}
	 * @access public
	 * @readonly
	 */
	get appRoot() {
		return require('app-root-path')
	}

	/**
	 * The application's version number
	 * @type {string}
	 * @access public
	 * @readonly
	 */
	get appVersion() {
		return this.pkgInfo.version
	}

	/**
	 * The application UI's IP address
	 * @type {string}
	 * @access public
	 */
	get bindIp() {
		this.config.getKey('bind_ip')
	}
	set bindIp(ip) {
		this.config.setKey('bind_ip', ip)

		if (this.server !== undefined) {
			this.server.listenForHttp()
		}
	}

	/**
	 * The application UI's TCP port
	 * @type {number}
	 * @access public
	 */
	get bindPort() {
		this.config.getKey('http_port')
	}
	set bindPort(port) {
		var p = parseInt(port)

		if (p >= 1024 && p <= 65535) {
			this.config.setKey('http_port', p)
			if (this.server !== undefined) {
				this.server.listenForHttp()
			}
		}
	}

	/**
	 * The folder path to the config/db
	 * @type {string}
	 * @access public
	 */
	get cfgDir() {
		return this.config.cfgDir
	}
	set cfgDir(dir) {
		this.skeletonInfo['configDir'] = dir

		this.debug('configuration directory', dir)
		let cfgDir = dir + '/companion/'

		mkdirp(cfgDir, (err) => {
			this.debug('mkdirp', cfgDir, err)

			this.config = new Config(this, cfgDir, {
				http_port: 8888,
				bind_ip: '127.0.0.1',
				start_minimised: false,
			})

			this.emit('skeleton-info', 'configDir', dir)
			this.emit('skeleton-info', 'appURL', 'Waiting for webserver..')
			this.emit('skeleton-info', 'startMinimised', this.config.getKey('start_minimised'))
		})
	}

	/**
	 * Initiate an application exit/stop
	 * @access public
	 */
	exit() {
		console.log('somewhere, the system wants to exit. kthxbai')

		this.quit()

		setImmediate(() => {
			process.exit()
		})
	}

	/**
	 * The current version number for the db and file import/export
	 * @type {number}
	 * @access public
	 * @readonly
	 */
	get fileVersion() {
		return 2
	}

	/**
	 * Launch the core application
	 * @param {boolean} [logToFile = false] - <code>true</code> to enable logging to file
	 * @access public
	 */
	launch(logToFile = false) {
		if (logToFile) {
			this.debug('Going into headless mode. Logs will be written to companion.log')
			this.startLogging()
		}

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
		this.devices = new DeviceController(this)
		this.preview = new Preview(this)
		this.instance = new InstanceController(this)
		this.service = new ServiceController(this)
		this.loadsave = new ImportExport(this)
		this.preset = new Preset(this)

		this.system.emit('modules_loaded')
	}

	/**
	 * Execute a graceful exit
	 * @access protected
	 */
	quit() {
		this.devices.quit()
		this.instance.destroyAll()
		this.db.saveImmediate()
	}

	/**
	 * Initiate an application restart
	 * @access public
	 */
	restart() {
		console.log('somewhere, the system wants to restart. kthxbai')

		this.quit()

		this.emit('restart')
	}

	/**
	 * Start logging to file
	 * @access protected
	 */
	startLogging() {
		setInterval(() => {
			if (this.logbuffer.length > 0 && this.logwriting == false) {
				var writestring = this.logbuffer.join('\n')
				this.logbuffer = []
				this.logwriting = true
				fs.appendFile('./companion.log', writestring + '\n', (err) => {
					if (err) {
						console.log('log write error', err)
					}
					this.logwriting = false
				})
			}
		}, 1000)

		process.stderr.write = () => {
			var arr = []
			for (var n in arguments) {
				arr.push(arguments[n])
			}
			var line = new Date().toISOString() + ' ' + stripAnsi(arr.join(' ').trim())
			this.logbuffer.push(line)
		}
	}

	/**
	 * The application UI's minimise on startup behavior
	 * @type {boolean}
	 * @access public
	 */
	get startMinimised() {
		this.config.getKey('start_minimised')
	}
	set startMinimised(minimised) {
		this.config.setKey('start_minimised', minimised)
	}
}

exports = module.exports = new Registry()
