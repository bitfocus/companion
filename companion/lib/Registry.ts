import EventEmitter from 'events'
import fs from 'fs-extra'
import express from 'express'
import LogController, { Logger } from './Log/Controller.js'
import { CloudController } from './Cloud/Controller.js'
import { ControlsController } from './Controls/Controller.js'
import { GraphicsController } from './Graphics/Controller.js'
import { GraphicsPreview } from './Graphics/Preview.js'
import { DataController } from './Data/Controller.js'
import { DataDatabase } from './Data/Database.js'
import { DataUserConfig } from './Data/UserConfig.js'
import { InstanceController } from './Instance/Controller.js'
import { InternalController } from './Internal/Controller.js'
import { PageController } from './Page/Controller.js'
import { ServiceController } from './Service/Controller.js'
import { SurfaceController } from './Surface/Controller.js'
import { UIController } from './UI/Controller.js'
import { UIHandler } from './UI/Handler.js'
import { sendOverIpc, showErrorMessage } from './Resources/Util.js'
import { VariablesController } from './Variables/Controller.js'
import { DataMetrics } from './Data/Metrics.js'
import { InternalActionRecorder } from './Internal/ActionRecorder.js'
import { InternalControls } from './Internal/Controls.js'
import { InternalCustomVariables } from './Internal/CustomVariables.js'
import { InternalInstance } from './Internal/Instance.js'
import { InternalPage } from './Internal/Page.js'
import { InternalSurface } from './Internal/Surface.js'
import { InternalSystem } from './Internal/System.js'
import { InternalTime } from './Internal/Time.js'
import { InternalTriggers } from './Internal/Triggers.js'
import { InternalVariables } from './Internal/Variables.js'
import { ImportExportController } from './ImportExport/Controller.js'
import { ServiceOscSender } from './Service/OscSender.js'
import type { ControlCommonEvents } from './Controls/ControlDependencies.js'
import type { PackageJson } from 'type-fest'

const pkgInfoStr = await fs.readFile(new URL('../package.json', import.meta.url))
const pkgInfo: PackageJson = JSON.parse(pkgInfoStr.toString())

let buildNumber: string
try {
	if (process.env.VITEST_WORKER_ID) {
		buildNumber = '0.0.0-VITEST'
	} else {
		buildNumber = fs
			.readFileSync(new URL('../../BUILD', import.meta.url))
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
export class Registry {
	/**
	 * The cloud controller
	 */
	#cloud!: CloudController
	/**
	 * The core controls controller
	 */
	controls!: ControlsController
	/**
	 * The core database library
	 */
	readonly db: DataDatabase
	/**
	 * The core graphics controller
	 */
	graphics!: GraphicsController
	/**
	 * The core instance controller
	 */
	instance!: InstanceController
	/**
	 * The core interface client
	 */
	readonly io: UIHandler
	/**
	 * The logger
	 */
	#logger: Logger
	/**
	 * The core page controller
	 */
	page!: PageController
	/**
	 * The core page controller
	 */
	#preview!: GraphicsPreview
	/**
	 * The core service controller
	 */
	services!: ServiceController
	/**
	 * The core device controller
	 */
	surfaces!: SurfaceController
	/**
	 * The core user config manager
	 */
	readonly userconfig: DataUserConfig

	/**
	 * The 'internal' module
	 */
	internalModule!: InternalController

	#importExport!: ImportExportController

	#metrics!: DataMetrics

	/**
	 * The 'data' controller
	 */
	readonly #data: DataController

	/**
	 * The 'ui' controller
	 */
	readonly ui: UIController

	/**
	 * Express Router for /int api endpoints
	 */
	readonly internalApiRouter = express.Router()

	variables!: VariablesController

	readonly appInfo: AppInfo

	/**
	 * Create a new application <code>Registry</code>
	 * @param configDir - the configuration path
	 * @param modulesDir - the path for storing modules
	 * @param machineId - the machine uuid
	 */
	constructor(configDir: string, modulesDir: string, machineId: string) {
		if (!configDir) throw new Error(`Missing configDir`)
		if (!machineId) throw new Error(`Missing machineId`)

		this.#logger = LogController.createLogger('Registry')

		this.#logger.info(`Build ${buildNumber}`)
		this.#logger.info(`configuration directory: ${configDir}`)

		this.appInfo = {
			configDir: configDir,
			modulesDir: modulesDir,
			machineId: machineId,
			appVersion: pkgInfo.version!,
			appBuild: buildNumber,
			pkgInfo: pkgInfo,
		}

		this.#logger.debug('constructing core modules')

		this.ui = new UIController(this.appInfo, this.internalApiRouter)
		this.io = this.ui.io
		LogController.init(this.appInfo, this.ui.io)

		this.db = new DataDatabase(this.appInfo.configDir)
		this.#data = new DataController(this)
		this.userconfig = this.#data.userconfig
	}

	/**
	 * Startup the application
	 * @param extraModulePath - extra directory to search for modules
	 * @param bindIp
	 * @param bindPort
	 */
	async ready(extraModulePath: string, bindIp: string, bindPort: number) {
		this.#logger.debug('launching core modules')

		const controlEvents = new EventEmitter<ControlCommonEvents>()

		this.page = new PageController(this)
		this.controls = new ControlsController(this, controlEvents)
		this.variables = new VariablesController(this.db, this.io)
		this.graphics = new GraphicsController(this.controls, this.page, this.userconfig, this.variables.values)
		this.#preview = new GraphicsPreview(this.graphics, this.io, this.page, this.variables.values)
		this.surfaces = new SurfaceController(
			this.db,
			{
				controls: this.controls,
				graphics: this.graphics,
				page: this.page,
				userconfig: this.userconfig,
				variables: this.variables,
			},
			this.io
		)

		const oscSender = new ServiceOscSender(this)
		this.instance = new InstanceController(
			this.appInfo,
			this.io,
			this.db,
			this.#data.cache,
			this.internalApiRouter,
			this.controls,
			this.graphics,
			this.page,
			this.variables,
			oscSender
		)
		this.ui.express.connectionApiRouter = this.instance.connectionApiRouter

		this.internalModule = new InternalController(this.controls, this.page, this.instance.definitions, this.variables)
		this.#importExport = new ImportExportController(
			this.appInfo,
			this.internalApiRouter,
			this.io,
			this.controls,
			this.graphics,
			this.instance,
			this.internalModule,
			this.page,
			this.surfaces,
			this.userconfig,
			this.variables
		)

		this.internalModule.addFragments(
			new InternalActionRecorder(this.internalModule, this.controls.actionRecorder, this.page),
			new InternalInstance(this.internalModule, this.instance),
			new InternalTime(this.internalModule),
			new InternalControls(this.internalModule, this.graphics, this.controls, this.page),
			new InternalCustomVariables(this.internalModule, this.variables),
			new InternalPage(this.internalModule, this.page),
			new InternalSurface(this.internalModule, this.surfaces, this.controls, this.page),
			new InternalSystem(this.internalModule, this),
			new InternalTriggers(this.internalModule, this.controls),
			new InternalVariables(this.internalModule, this.controls)
		)
		this.internalModule.init()

		this.#metrics = new DataMetrics(this.appInfo, this.surfaces, this.instance)
		this.services = new ServiceController(this, oscSender, controlEvents)
		this.#cloud = new CloudController(
			this.appInfo,
			this.db,
			this.#data.cache,
			this.controls,
			this.graphics,
			this.io,
			this.page
		)

		this.ui.io.on('clientConnect', (client) => {
			LogController.clientConnect(client)
			this.ui.clientConnect(client)
			this.#data.clientConnect(client)
			this.page.clientConnect(client)
			this.controls.clientConnect(client)
			this.#preview.clientConnect(client)
			this.surfaces.clientConnect(client)
			this.instance.clientConnect(client)
			this.#cloud.clientConnect(client)
			this.services.clientConnect(client)
			this.#importExport.clientConnect(client)
		})

		this.variables.values.on('variables_changed', (all_changed_variables_set) => {
			this.internalModule.onVariablesChanged(all_changed_variables_set, null)
			this.controls.onVariablesChanged(all_changed_variables_set, null)
			this.instance.moduleHost.onVariablesChanged(all_changed_variables_set)
			this.#preview.onVariablesChanged(all_changed_variables_set)
			this.surfaces.onVariablesChanged(all_changed_variables_set)
		})

		// old 'modules_loaded' events
		this.#metrics.startCycle()
		this.ui.update.startCycle()

		this.controls.init()
		this.controls.verifyConnectionIds()
		this.variables.custom.init()
		this.internalModule.firstUpdate()
		this.graphics.regenerateAll(false)

		// We are ready to start the instances/connections
		await this.instance.initInstances(extraModulePath)

		// Instances are loaded, start up http
		this.rebindHttp(bindIp, bindPort)

		// Startup has completed, run triggers
		this.controls.triggers.emit('startup')

		if (process.env.COMPANION_IPC_PARENT) {
			process.on('message', (msg: any): void => {
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
					this.#logger.debug(`Failed to handle IPC message: ${e}`)
				}
			})
		}

		if (process.env.COMPANION_IPC_PARENT || process.env.COMPANION_DEV_MODULES) {
			process.on('message', (msg: any): void => {
				try {
					if (msg.messageType === 'reload-extra-module') {
						this.instance.modules.reloadExtraModule(msg.fullpath).catch((e) => {
							this.#logger.warn(`Failed to reload module: ${e}`)
						})
					}
				} catch (e) {
					this.#logger.debug(`Failed to handle IPC message: ${e}`)
				}
			})
		}
	}

	/**
	 * Request application exit
	 */
	exit(fromInternal: boolean, restart: boolean) {
		Promise.resolve().then(async () => {
			this.#logger.info('somewhere, the system wants to exit. kthxbai')

			// Save the db to disk
			this.db.close()
			this.#data.cache.close()

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
	 */
	rebindHttp(bindIp: string, bindPort: number): void {
		// ensure the port looks reasonable
		if (bindPort < 1024 || bindPort > 65535) {
			bindPort = 8000
		}

		this.ui.server.rebindHttp(bindIp, bindPort)
		this.userconfig.updateBindIp(bindIp)
		this.services.https.updateBindIp(bindIp)
		this.internalModule.updateBindIp(bindIp)
	}
}

export interface AppInfo {
	/** The current config directory */
	configDir: string
	/** The base directory for storing installed modules */
	modulesDir: string
	machineId: string
	appVersion: string
	appBuild: string
	pkgInfo: PackageJson
}
