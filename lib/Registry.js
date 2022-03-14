if (process.env.DEVELOPER !== undefined && process.env.DEBUG === undefined) {
	process.env['DEBUG'] = '*,-websocket*,-express*,-engine*,-socket.io*,-send*,-db,-NRC*,-follow-redirects'
}

const BankController = require('./Bank/Controller')
const CloudController = require('./Cloud/Controller')
const GraphicsController = require('./Graphics/Controller')
const GraphicsPreview = require('./Graphics/Preview')
const DataCache = require('./Data/Cache')
const DataController = require('./Data/Controller')
const DataDatabase = require('./Data/Database')
const DataUserConfig = require('./Data/UserConfig')
const InstanceController = require('./Instance/Controller')
const InternalController = require('./Internal/Controller')
const PageController = require('./Page/Controller')
const ServiceController = require('./Service/Controller')
const SurfaceController = require('./Surface/Controller')
const TriggersController = require('./Triggers/Controller')
const UIController = require('./UI/Controller')
const UIHandler = require('./UI/Handler')
const UILog = require('./UI/Log')

const EventEmitter = require('events')

global.MAX_BUTTONS = 32
global.MAX_BUTTONS_PER_ROW = 8

const fs = require('fs-extra')
const debug = require('debug')('App')
const stripAnsi = require('strip-ansi')
const shortid = require('shortid')
const path = require('path')

var logbuffer = []
var logwriting = false

const pkgInfo = require('../package.json')
let buildNumber
try {
	buildNumber = fs
		.readFileSync(__dirname + '/../BUILD')
		.toString()
		.trim()
} catch (e) {
	console.error('Companion cannot start as the "BUILD" file is missing')
	console.error('If you are running from source, you can generate it by running: yarn build:writefile')
	process.exit(1)
}

/**
 * The core controller that sets up all the controllers needed
 * for the app.
 *
 * @extends EventEmitter
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
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 */
class Registry extends EventEmitter {
	/**
	 * The core bank controller
	 * @type {BankController}
	 * @access public
	 */
	bank
	/**
	 * The disk cache library
	 * @type {DataCache}
	 * @access public
	 */
	cache
	/**
	 * The core database library
	 * @type {DataDatabase}
	 * @access public
	 */
	db
	/**
	 * The debugger for this class
	 * @type {debug.Debugger}
	 * @access protected
	 */
	debug = require('debug')('lib/Registry')
	/**
	 * The core graphics controller
	 * @type {GraphicsController}
	 * @access public
	 */
	graphics
	/**
	 * The core instance controller
	 * @type {InstanceController}
	 * @access public
	 */
	instance
	/**
	 * The core interface client
	 * @type {UIHandler}
	 * @access public
	 */
	io
	/**
	 * The UI logger
	 * @type {UILog}
	 * @access public
	 */
	log
	/**
	 * The core page controller
	 * @type {PageController}
	 * @access public
	 */
	page
	/**
	 * The core page controller
	 * @type {GraphicsPreview}
	 * @access public
	 */
	preview
	/**
	 * The core service controller
	 * @type {ServiceController}
	 * @access public
	 */
	services
	/**
	 * The core device controller
	 * @type {SurfaceController}
	 * @access public
	 */
	surfaces
	/**
	 * The modules' event emitter interface
	 * @type {EventEmitter}
	 * @access public
	 */
	system
	/**
	 * The core schedule controller
	 * @type {TriggersController}
	 * @access public
	 */
	triggers
	/**
	 * The core user config manager
	 * @type {DataUserConfig}
	 * @access public
	 */
	userconfig

	/**
	 * The 'internal' module
	 * @type {InternalController}
	 * @access public
	 */
	internalModule

	/**
	 * Create a new application <code>Registry</code> with defaults
	 * @param {string} configDirPrefix - the base configuration path
	 * @returns {Registry} the new application
	 */
	static async create(configDirPrefix) {
		debug('configuration directory', configDirPrefix)
		const configDir = configDirPrefix + '/companion/'
		await fs.ensureDir(configDir)

		// load the machine id
		let machineId = shortid.generate()
		const machineIdPath = path.join(configDir, 'machid')
		if (await fs.pathExists(machineIdPath)) {
			let text = ''
			try {
				text = await fs.readFile(machineIdPath)
				if (text) {
					machineId = text.toString()
					debug('read machid', machineId)
				}
			} catch (e) {
				debug('error reading uuid-file', e)
			}
		} else {
			debug('creating uuid file')
			await fs.writeFile(machineIdPath, machineId).catch((e) => {
				debug(`failed to write uuid file`, e)
			})
		}

		return new Registry(configDir, machineId)
	}

	/**
	 * @param {string} configDir
	 * @param {string} machineId
	 */
	constructor(configDir, machineId) {
		super()

		this.configDir = configDir
		this.machineId = machineId
		this.appVersion = pkgInfo.version
		this.appBuild = buildNumber.replace(/^-/, '')

		this.system = new EventEmitter()
		// Supress warnings for too many listeners to io_connect. This can be safely increased if the warning comes back at startup
		this.system.setMaxListeners(20)
	}

	/**
	 * Startup the application, and bind the http server to an ip and port
	 * @param {string} bind_ip
	 * @param {number} http_port
	 */
	ready(bind_ip, http_port, logToFile) {
		if (logToFile) {
			debug('Going into headless mode. Logs will be written to companion.log')

			setInterval(function () {
				if (logbuffer.length > 0 && logwriting == false) {
					var writestring = logbuffer.join('\n')
					logbuffer = []
					logwriting = true
					fs.appendFile('./companion.log', writestring + '\n', function (err) {
						if (err) {
							console.log('log write error', err)
						}
						logwriting = false
					})
				}
			}, 1000)

			process.stderr.write = function () {
				var arr = []
				for (var n in arguments) {
					arr.push(arguments[n])
				}
				var line = new Date().toISOString() + ' ' + stripAnsi(arr.join(' ').trim())
				logbuffer.push(line)
			}
		}

		// Legacy: Internal module
		this.system.on('get_page', (cb) => {
			cb(this.page.pages)
		})
		this.system.on('db_get', (type, cb) => {
			if (type !== 'bank') throw new Error('Not supported')
			cb(this.bank.config)
		})
		this.system.on('bank_changefield', (...args) => {
			this.bank.changeField(...args)
		})

		this.debug('launching core modules')

		this.ui = new UIController(this)
		this.io = this.ui.io
		this.log = this.ui.log
		this.db = new DataDatabase(this)
		this.data = new DataController(this)
		this.cache = this.data.cache
		this.userconfig = this.data.userconfig
		this.page = new PageController(this)
		this.bank = new BankController(this)
		this.graphics = new GraphicsController(this)
		this.preview = new GraphicsPreview(this)
		this.surfaces = new SurfaceController(this)
		this.instance = new InstanceController(this)
		this.triggers = new TriggersController(this)
		this.services = new ServiceController(this)
		this.cloud = new CloudController(this)
		this.internalModule = new InternalController(this)

		// old 'modules_loaded' events
		this.data.metrics.setCycle()
		this.data.importExport.loadData()
		this.triggers.onSystemReady()

		setTimeout(() => {
			this.rebindHttp(bind_ip, http_port)
		}, 3000)

		this.on('exit', async () => {
			console.log('somewhere, the system wants to exit. kthxbai')

			try {
				this.surfaces.quit()
			} catch (e) {
				//do nothing
			}

			try {
				await this.instance.destroyAllInstances()
			} catch (e) {
				//do nothing
			}

			setImmediate(function () {
				process.exit()
			})
		})
	}

	/**
	 * Rebind the http server to an ip and port (https will update to the same ip if running)
	 * @param {string} bind_ip
	 * @param {number} http_port
	 */
	rebindHttp(bind_ip, http_port) {
		// ensure the port looks reasonable
		if (http_port < 1024 || http_port > 65535) {
			http_port = 8000
		}

		this.emit('http_rebind', bind_ip, http_port)
	}
}

module.exports = Registry
