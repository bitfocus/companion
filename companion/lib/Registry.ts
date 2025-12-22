/* eslint-disable n/no-process-exit */
import EventEmitter from 'events'
import fs from 'fs-extra'
import express from 'express'
import LogController, { type Logger } from './Log/Controller.js'
import { CloudController } from './Cloud/Controller.js'
import { ControlsController } from './Controls/Controller.js'
import { GraphicsController } from './Graphics/Controller.js'
import { DataController } from './Data/Controller.js'
import { DataDatabase } from './Data/Database.js'
import type { DataUserConfig } from './Data/UserConfig.js'
import { InstanceController } from './Instance/Controller.js'
import { InternalController } from './Internal/Controller.js'
import { PageController } from './Page/Controller.js'
import { ServiceController } from './Service/Controller.js'
import { SurfaceController } from './Surface/Controller.js'
import { UIController } from './UI/Controller.js'
import { isPackaged, sendOverIpc, showErrorMessage } from './Resources/Util.js'
import { VariablesController } from './Variables/Controller.js'
import { DataUsageStatistics } from './Data/UsageStatistics.js'
import { ImportExportController } from './ImportExport/Controller.js'
import { ServiceOscSender } from './Service/OscSender.js'
import type { ControlCommonEvents } from './Controls/ControlDependencies.js'
import type { PackageJson } from 'type-fest'
import { ServiceApi } from './Service/ServiceApi.js'
import { ActiveLearningStore } from './Resources/ActiveLearningStore.js'
import { createTrpcRouter } from './UI/TRPC.js'
import { PageStore } from './Page/Store.js'
import { PreviewController } from './Preview/Controller.js'
import path from 'path'
import type { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'

let infoFileName: URL
// note this could be done in one line, but webpack was having trouble before url processing was disabled.
if (isPackaged()) {
	infoFileName = new URL('./package.json', import.meta.url)
} else {
	infoFileName = new URL('../package.json', import.meta.url)
}
//console.log(`infoFileName: ${infoFileName}; `)
const pkgInfoStr = await fs.readFile(infoFileName)
const pkgInfo: PackageJson = JSON.parse(pkgInfoStr.toString())

let buildNumber: string
try {
	if (process.env.VITEST_WORKER_ID) {
		buildNumber = '0.0.0-VITEST'
	} else {
		buildNumber = fs
			.readFileSync(path.join(import.meta.dirname, isPackaged() ? './BUILD' : '../../BUILD'))
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
	cloud!: CloudController
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
	preview!: PreviewController
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

	importExport!: ImportExportController

	usageStatistics!: DataUsageStatistics

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

	readonly variables: VariablesController

	readonly #appInfo: AppInfo

	#isReady = false

	/**
	 * Create a new application <code>Registry</code>
	 * @param configDir - the configuration path
	 * @param modulesDirs - the paths for storing modules
	 * @param machineId - the machine uuid
	 */
	constructor(
		baseAppInfo: Pick<AppInfo, 'configDir' | 'modulesDirs' | 'builtinModuleDirs' | 'udevRulesDir' | 'machineId'>
	) {
		if (!baseAppInfo.configDir) throw new Error(`Missing configDir`)
		if (!baseAppInfo.machineId) throw new Error(`Missing machineId`)
		if (!baseAppInfo.modulesDirs) throw new Error(`Missing modulesDirs`)
		if (!baseAppInfo.udevRulesDir) throw new Error(`Missing udevRulesDir`)

		this.#logger = LogController.createLogger('Registry')

		this.#logger.info(`Build ${buildNumber}`)
		this.#logger.info(`configuration directory: ${baseAppInfo.configDir}`)

		this.#appInfo = {
			...baseAppInfo,
			appVersion: pkgInfo.version!,
			appBuild: buildNumber,
			pkgInfo: pkgInfo,
		}

		this.#logger.debug('constructing core modules')

		this.ui = new UIController(this.#appInfo, this.#internalApiRouter)
		LogController.init(this.#appInfo)

		this.db = new DataDatabase(this.#appInfo.configDir)
		this.#data = new DataController(this.#appInfo, this.db)
		this.userconfig = this.#data.userconfig

		this.variables = new VariablesController(this.db)
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
			controlEvents.setMaxListeners(0)

			const activeLearningStore = new ActiveLearningStore()
			const pageStore = new PageStore(this.db.getTableView('pages'))
			this.controls = new ControlsController(this, controlEvents, activeLearningStore)

			this.graphics = new GraphicsController(
				this.controls,
				pageStore,
				this.userconfig,
				this.variables,
				this.db,
				this.#internalApiRouter
			)
			this.surfaces = new SurfaceController(this.db, {
				controls: this.controls,
				graphics: this.graphics,
				pageStore: pageStore,
				userconfig: this.userconfig,
				variables: this.variables,
			})

			const oscSender = new ServiceOscSender(this.userconfig)
			this.instance = new InstanceController(
				this.#appInfo,
				this.db,
				this.#data.cache,
				this.#internalApiRouter,
				this.controls,
				this.variables,
				this.surfaces,
				oscSender
			)
			this.ui.express.connectionApiRouter = this.instance.connectionApiRouter

			this.internalModule = new InternalController(
				this.#appInfo,
				this.controls,
				pageStore,
				this.instance,
				this.variables,
				this.surfaces,
				this.graphics,
				this.userconfig,
				controlEvents,
				this.exit.bind(this)
			)

			this.page = new PageController(this.graphics, this.controls, this.userconfig, pageStore)
			this.importExport = new ImportExportController(
				this.#appInfo,
				this.#internalApiRouter,
				this.db,
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
				this.graphics,
				controlEvents
			)

			this.services = new ServiceController(
				serviceApi,
				this.userconfig,
				oscSender,
				this.surfaces,
				pageStore,
				this.instance,
				this.ui.io,
				this.ui.express
			)
			this.cloud = new CloudController(
				this.#appInfo,
				this.db,
				this.#data.cache,
				this.controls,
				this.graphics,
				pageStore
			)
			this.usageStatistics = new DataUsageStatistics(
				this.#appInfo,
				this.surfaces,
				this.instance,
				this.page,
				this.controls,
				this.variables,
				this.cloud,
				this.services,
				this.userconfig
			)

			this.preview = new PreviewController(
				this.instance.definitions,
				this.graphics,
				pageStore,
				this.controls,
				controlEvents
			)

			this.instance.status.on('status_change', () => this.controls.checkAllStatus())
			controlEvents.on('invalidateControlRender', (controlId) => this.graphics.invalidateControl(controlId))
			controlEvents.on('invalidateLocationRender', (location) => this.graphics.invalidateButton(location))

			this.graphics.on('resubscribeFeedbacks', () => this.instance.processManager.resubscribeAllFeedbacks())
			this.graphics.on('presetDrawn', (controlId, render) => controlEvents.emit('presetDrawn', controlId, render))

			this.userconfig.on('keyChanged', (key, value, checkControlsInBounds) => {
				setImmediate(() => {
					// give the change a chance to be pushed to the ui first
					this.graphics.updateUserConfig(key, value)
					this.services.updateUserConfig(key, value)
					this.surfaces.updateUserConfig(key, value)
					this.usageStatistics.updateUserConfig(key, value)
				})

				if (checkControlsInBounds) {
					const controlsToRemove = this.page.findAllOutOfBoundsControls()

					for (const controlId of controlsToRemove) {
						this.controls.deleteControl(controlId)
					}

					this.graphics.discardAllOutOfBoundsControls()
				}
			})

			this.variables.values.on('variables_changed', (all_changed_variables_set) => {
				this.internalModule.onVariablesChanged(all_changed_variables_set, null)
				this.controls.onVariablesChanged(all_changed_variables_set, null)
				this.instance.processManager.onVariablesChanged(all_changed_variables_set)
				this.preview.onVariablesChanged(all_changed_variables_set, null)
				this.surfaces.onVariablesChanged(all_changed_variables_set)
			})
			this.variables.values.on('local_variables_changed', (all_changed_variables_set, fromControlId) => {
				this.internalModule.onVariablesChanged(all_changed_variables_set, fromControlId)
				this.controls.onVariablesChanged(all_changed_variables_set, fromControlId)
				this.preview.onVariablesChanged(all_changed_variables_set, fromControlId)
			})
			this.instance.definitions.on('updateCompositeElements', (elementIds) => {
				this.controls.onCompositeElementsChanged(elementIds)
				this.preview.onConnectionCompositeElementsChanged(elementIds)
			})

			this.page.on('controlIdsMoved', (controlIds) => {
				this.preview.onControlIdsLocationChanged(controlIds)
			})

			this.graphics.on('button_drawn', (location, render) => {
				this.services.onButtonDrawn(location, render)
			})

			// old 'modules_loaded' events
			this.usageStatistics.startStopCycle()
			this.ui.update.startCycle()

			this.controls.init()
			this.controls.verifyConnectionIds()
			this.variables.custom.init()
			this.internalModule.firstUpdate()
			this.graphics.regenerateAll(false)

			// We are ready to start the instances/connections
			await this.instance.initInstances(extraModulePath)

			// Instances are loaded, start up http
			const router = createTrpcRouter(this)
			this.ui.io.bindTrpcRouter(router, () => {
				this.controls.triggers.emit('client_connect')
			})
			this.rebindHttp(bindIp, bindPort)

			// Startup has completed, run triggers
			this.controls.triggers.emit('startup')

			if (process.env.COMPANION_IPC_PARENT) {
				process.on('message', (msg: any): void => {
					try {
						if (msg.messageType === 'http-rebind') {
							this.rebindHttp(msg.ip, Number(msg.port))
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
			this.#logger.debug((e as Error)?.stack)
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

			this.ui.close()

			// Save the db to disk
			this.db.close()
			this.#data.cache.close()

			try {
				this.surfaces.quit()
			} catch (_e) {
				//do nothing
			}

			try {
				await this.instance.shutdownAllInstances()
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

		this.userconfig.updateBindIp(bindIp)
		this.services.https.updateBindIp(bindIp)
		this.internalModule.updateBindIp(bindIp, bindPort)
		this.usageStatistics.updateBindIp(bindIp)
		this.ui.server.rebindHttp(bindIp, bindPort)
	}
}

export interface AppInfo {
	/** The current config directory */
	configDir: string
	/** The base directory for storing installed modules */
	modulesDirs: Record<ModuleInstanceType, string>
	/** The builtin module directories */
	builtinModuleDirs: Record<ModuleInstanceType, string | null>
	/** The path to store generated udev rules */
	udevRulesDir: string
	machineId: string
	appVersion: string
	appBuild: string
	pkgInfo: PackageJson
}
