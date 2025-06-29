/* eslint-disable n/no-process-exit */
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
import { ImportExportController } from './ImportExport/Controller.js'
import { ServiceOscSender } from './Service/OscSender.js'
import type { ControlCommonEvents } from './Controls/ControlDependencies.js'
import type { PackageJson } from 'type-fest'
import { ServiceApi } from './Service/ServiceApi.js'
import { setGlobalDispatcher, EnvHttpProxyAgent } from 'undici'
import { PageStore } from './Page/Store.js'

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
} catch (_e) {
	console.error('Companion cannot start as the "BUILD" file is missing')
	console.error('If you are running from source, you can generate it by running: yarn build:writefile')
	process.exit(1)
}

if (process.env.COMPANION_IPC_PARENT && !process.send) {
	console.error('COMPANION_IPC_PARENT is set, but process.send is undefined')
	process.exit(1)
}

// Setup support for HTTP_PROXY before anything might use it
if (process.env.NODE_USE_ENV_PROXY) {
	// HACK: This is temporary and should be removed once https://github.com/nodejs/node/pull/57165 has been backported to node 22
	const envHttpProxyAgent = new EnvHttpProxyAgent()
	setGlobalDispatcher(envHttpProxyAgent)
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
	#services!: ServiceController
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
	readonly #internalApiRouter = express.Router()

	variables!: VariablesController

	readonly #appInfo: AppInfo

	#isReady = false

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

		this.#appInfo = {
			configDir: configDir,
			modulesDir: modulesDir,
			machineId: machineId,
			appVersion: pkgInfo.version!,
			appBuild: buildNumber,
			pkgInfo: pkgInfo,
		}

		this.#logger.debug('constructing core modules')

		this.ui = new UIController(this.#appInfo, this.#internalApiRouter)
		this.io = this.ui.io
		LogController.init(this.#appInfo, this.ui.io)

		this.db = new DataDatabase(this.#appInfo.configDir)
		this.#data = new DataController(this.#appInfo, this.db)
		this.userconfig = this.#data.userconfig
	}

	/**
	 * Startup the application
	 * @param extraModulePath - extra directory to search for modules
	 * @param bindIp
	 * @param bindPort
	 */
	async ready(extraModulePath: string, bindIp: string, bindPort: number): Promise<void> {
		this.#logger.debug('launching core modules')

		try {
			const controlEvents = new EventEmitter<ControlCommonEvents>()

			const pageStore = new PageStore(this.db.getTableView('pages'))
			this.controls = new ControlsController(this, controlEvents)
			this.variables = new VariablesController(this.db, this.io, pageStore, this.controls)
			this.graphics = new GraphicsController(
				this.controls,
				pageStore,
				this.userconfig,
				this.variables.values,
				this.#internalApiRouter
			)
			this.#preview = new GraphicsPreview(this.graphics, this.io, pageStore, this.controls)
			this.surfaces = new SurfaceController(
				this.db,
				{
					controls: this.controls,
					graphics: this.graphics,
					pageStore: pageStore,
					userconfig: this.userconfig,
					variables: this.variables,
				},
				this.io
			)

			const oscSender = new ServiceOscSender(this.userconfig)
			this.instance = new InstanceController(
				this.#appInfo,
				this.io,
				this.db,
				this.#data.cache,
				this.#internalApiRouter,
				this.controls,
				this.graphics,
				pageStore,
				this.variables,
				oscSender
			)
			this.ui.express.connectionApiRouter = this.instance.connectionApiRouter

			this.internalModule = new InternalController(
				this.controls,
				pageStore,
				this.instance,
				this.variables,
				this.surfaces,
				this.graphics,
				this.exit.bind(this)
			)

			this.page = new PageController(this, pageStore)
			this.#importExport = new ImportExportController(
				this.#appInfo,
				this.#internalApiRouter,
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

			const serviceApi = new ServiceApi(
				this.#appInfo,
				pageStore,
				this.controls,
				this.surfaces,
				this.variables,
				this.graphics
			)

			this.#metrics = new DataMetrics(this.#appInfo, this.surfaces, this.instance)
			this.#services = new ServiceController(
				serviceApi,
				this.userconfig,
				oscSender,
				controlEvents,
				this.surfaces,
				pageStore,
				this.instance,
				this.io,
				this.ui.express
			)
			this.#cloud = new CloudController(
				this.#appInfo,
				this.db,
				this.#data.cache,
				this.controls,
				this.graphics,
				this.io,
				pageStore
			)

			this.userconfig.on('keyChanged', (key, value, checkControlsInBounds) => {
				this.io.emitToAll('set_userconfig_key', key, value)
				setImmediate(() => {
					// give the change a chance to be pushed to the ui first
					this.graphics.updateUserConfig(key, value)
					this.#services.updateUserConfig(key, value)
					this.surfaces.updateUserConfig(key, value)
				})

				if (checkControlsInBounds) {
					const controlsToRemove = this.page.findAllOutOfBoundsControls()

					for (const controlId of controlsToRemove) {
						this.controls.deleteControl(controlId)
					}

					this.graphics.discardAllOutOfBoundsControls()
				}
			})

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
				this.#services.clientConnect(client)
				this.#importExport.clientConnect(client)
			})

			this.variables.values.on('variables_changed', (all_changed_variables_set) => {
				this.internalModule.onVariablesChanged(all_changed_variables_set, null)
				this.controls.onVariablesChanged(all_changed_variables_set, null)
				this.instance.moduleHost.onVariablesChanged(all_changed_variables_set)
				this.#preview.onVariablesChanged(all_changed_variables_set, null)
				this.surfaces.onVariablesChanged(all_changed_variables_set)
			})
			this.variables.values.on('local_variables_changed', (all_changed_variables_set, fromControlId) => {
				this.internalModule.onVariablesChanged(all_changed_variables_set, fromControlId)
				this.controls.onVariablesChanged(all_changed_variables_set, fromControlId)
				this.#preview.onVariablesChanged(all_changed_variables_set, fromControlId)
			})

			this.page.on('controlIdsMoved', (controlIds) => {
				this.#preview.onControlIdsLocationChanged(controlIds)
			})

			this.graphics.on('button_drawn', (location, render) => {
				this.#services.onButtonDrawn(location, render)
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
		} catch (e) {
			// We aren't ready, but we need exit to work
			this.#isReady = true

			this.#logger.error(`Failed to start companion: ${e}`)
			this.#logger.debug(e)
			this.exit(true, false)
		} finally {
			this.#isReady = true
		}
	}

	/**
	 * Request application exit
	 */
	exit(fromInternal: boolean, restart: boolean): void {
		if (!this.#isReady) {
			this.#logger.debug('exit called before ready')
			return
		}

		void Promise.resolve().then(async () => {
			this.#logger.info('somewhere, the system wants to exit. kthxbai')

			// Save the db to disk
			this.db.close()
			this.#data.cache.close()

			try {
				this.surfaces.quit()
			} catch (_e) {
				//do nothing
			}

			try {
				await this.instance.destroyAllInstances()
			} catch (_e) {
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
		this.#services.https.updateBindIp(bindIp)
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
