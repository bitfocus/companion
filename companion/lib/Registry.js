import EventEmitter from 'events'
import fs from 'fs-extra'
import express from 'express'
import LogController from './Log/Controller.js'
import CloudController from './Cloud/Controller.js'
import ControlsController from './Controls/Controller.js'
import GraphicsController from './Graphics/Controller.js'
import GraphicsPreview from './Graphics/Preview.js'
import DataController from './Data/Controller.js'
import DataDatabase from './Data/Database.js'
import CloudDatabase from './Data/CloudDatabase.js'
import DataUserConfig from './Data/UserConfig.js'
import InstanceController from './Instance/Controller.js'
import InternalController from './Internal/Controller.js'
import PageController from './Page/Controller.js'
import ServiceController from './Service/Controller.js'
import SurfaceController from './Surface/Controller.js'
import UIController from './UI/Controller.js'
import UIHandler from './UI/Handler.js'
import { sendOverIpc, showErrorMessage } from './Resources/Util.js'
import InstanceVariable from './Instance/Variable.js'

const pkgInfoStr = await fs.readFile(new URL('../package.json', import.meta.url))
const pkgInfo = JSON.parse(pkgInfoStr.toString())
/**
 * @type {string}
 */
let buildNumber
try {
	if (process.env.JEST_WORKER_ID) {
		buildNumber = '0.0.0-JEST'
	} else {
		buildNumber = fs
			.readFileSync(new URL('../BUILD', import.meta.url))
			.toString()
			.trim()
			.replace(/^-/, '')
	}
} catch (e) {
	console.error('Companion cannot start as the "BUILD" file is missing')
	console.error('If you are running from source, you can generate it by running: yarn build:writefile')
	process.exit(1)
}

if (process.env.COMPANION_IPC_PARENT && !process.send) {
	console.error('COMPANION_IPC_PARENT is set, but process.send is undefined')
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
	 * The cloud database
	 * @type {CloudDatabase}
	 * @access public
	 */
	clouddb
	/**
	 * The core controls controller
	 * @type {ControlsController}
	 * @access public
	 */
	controls
	/**
	 * The core database library
	 * @type {DataDatabase}
	 * @access public
	 */
	db
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
	 * The logger
	 * @type {LogController}
	 * @access public
	 * @deprecated
	 */
	log
	/**
	 * The logger
	 * @type {import('winston').Logger}
	 * @access public
	 */
	logger
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
	 * The 'data' controller
	 * @type {DataController}
	 * @access public
	 */
	data

	/**
	 * The 'ui' controller
	 * @type {UIController}
	 * @access public
	 */
	ui

	/**
	 * Express Router for /int api endpoints
	 * @type {import('express').Router}
	 * @access public
	 */
	api_router

	/**
	 * @type {AppInfo}
	 * @access public
	 * @readonly
	 */
	appInfo

	/**
	 * Create a new application <code>Registry</code>
	 * @param {string} configDir - the configuration path
	 * @param {string} machineId - the machine uuid
	 */
	constructor(configDir, machineId) {
		super()

		if (!configDir) throw new Error(`Missing configDir`)
		if (!machineId) throw new Error(`Missing machineId`)

		this.log = LogController
		this.logger = LogController.createLogger('Registry')

		this.logger.info(`Build ${buildNumber}`)
		this.logger.info(`configuration directory: ${configDir}`)

		this.appInfo = {
			configDir: configDir,
			machineId: machineId,
			appVersion: pkgInfo.version,
			appBuild: buildNumber,
			pkgInfo: pkgInfo,
		}
	}

	/**
	 * Startup the application
	 * @param {string} extraModulePath - extra directory to search for modules
	 * @param {string} bind_ip
	 * @param {number} http_port
	 */
	async ready(extraModulePath, bind_ip, http_port) {
		this.logger.debug('launching core modules')

		this.api_router = express.Router()
		this.ui = new UIController(this)
		this.io = this.ui.io
		this.db = new DataDatabase(this.appInfo.configDir)
		this.clouddb = new CloudDatabase(this.appInfo.configDir)
		this.data = new DataController(this)
		this.userconfig = this.data.userconfig
		LogController.init(this.appInfo, this.ui.io)
		this.page = new PageController(this)
		this.controls = new ControlsController(this)
		this.graphics = new GraphicsController(this)
		this.variable = new InstanceVariable(this)
		this.preview = new GraphicsPreview(this.graphics, this.io, this.page, this.variable)
		this.surfaces = new SurfaceController(this)
		this.instance = new InstanceController(this, this.variable)
		this.services = new ServiceController(this)
		this.cloud = new CloudController(this, this.clouddb, this.data.cache)
		this.internalModule = new InternalController(this)

		// old 'modules_loaded' events
		this.data.metrics.startCycle()

		this.controls.verifyConnectionIds()
		this.instance.variable.custom.init()
		this.internalModule.init()
		this.graphics.regenerateAll(false)

		// We are ready to start the instances/connections
		await this.instance.initInstances(extraModulePath)

		// Instances are loaded, start up http
		this.rebindHttp(bind_ip, http_port)

		// Startup has completed, run triggers
		this.controls.triggers.emit('startup')

		if (process.env.COMPANION_IPC_PARENT) {
			process.on(
				'message',
				/**
				 * @type {function(any):void}
				 */
				(msg) => {
					try {
						if (msg.messageType === 'http-rebind') {
							this.rebindHttp(msg.ip, msg.port)
						} else if (msg.messageType === 'exit') {
							this.exit(false, false)
						} else if (msg.messageType === 'scan-usb') {
							this.surfaces.triggerRefreshDevices().catch(() => {
								showErrorMessage('USB Scan Error', 'Failed to scan for USB devices.')
							})
						} else if (msg.messageType === 'power-status') {
							this.instance.powerStatusChange(msg.status)
						} else if (msg.messageType === 'lock-screen') {
							this.controls.triggers.emit('locked', !!msg.status)
						}
					} catch (e) {
						this.logger.debug(`Failed to handle IPC message: ${e}`)
					}
				}
			)
		}

		if (process.env.COMPANION_IPC_PARENT || process.env.COMPANION_DEV_MODULES) {
			process.on(
				'message',
				/**
				 * @type {function(any):void}
				 */
				(msg) => {
					try {
						if (msg.messageType === 'reload-extra-module') {
							this.instance.modules.reloadExtraModule(msg.fullpath).catch((e) => {
								this.logger.warn(`Failed to reload module: ${e}`)
							})
						}
					} catch (e) {
						this.logger.debug(`Failed to handle IPC message: ${e}`)
					}
				}
			)
		}
	}

	/**
	 * Request application exit
	 * @param {boolean} fromInternal
	 * @param {boolean} restart
	 */
	exit(fromInternal, restart) {
		Promise.resolve().then(async () => {
			this.logger.info('somewhere, the system wants to exit. kthxbai')

			// Save the db to disk
			this.db.save()
			this.data.cache.save()

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

			if (fromInternal) {
				// Inform the parent that we are shutting down
				sendOverIpc({
					messageType: 'exit',
					restart,
				})
			}

			setImmediate(function () {
				process.exit(restart ? 1 : 0)
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

export default Registry

/**
 * @typedef {{
 *   configDir: string
 *   machineId: string
 *   appVersion: string
 *   appBuild: string
 *   pkgInfo: string
 * }} AppInfo
 */
