import LogController, { type Logger } from '../Log/Controller.js'
import PQueue from 'p-queue'
import { nanoid } from 'nanoid'
import path from 'path'
import { ConnectionChildHandlerLegacy } from './Connection/ChildHandlerLegacy.js'
import type { ConnectionChildHandlerApi, ConnectionChildHandlerDependencies } from './Connection/ChildHandlerApi.js'
import fs from 'fs-extra'
import os from 'os'
import { getNodeJsPath, getNodeJsPermissionArguments } from './NodePath.js'
import { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import type { InstanceModules } from './Modules.js'
import type { InstanceConfigStore } from './ConfigStore.js'
import {
	isModuleApiVersionCompatible,
	isSurfaceApiVersionCompatible,
} from '@companion-app/shared/ModuleApiVersionCheck.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { createRequire } from 'module'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { ModuleInstanceType, type InstanceConfig } from '@companion-app/shared/Model/Instance.js'
import { assertNever } from '@companion-app/shared/Util.js'
import type { SomeModuleVersionInfo } from './Types.js'
import { SurfaceChildHandler, type SurfaceChildHandlerDependencies } from './Surface/ChildHandler.js'
import { isPackaged } from '../Resources/Util.js'
import type { SurfaceModuleManifest } from '@companion-surface/host'
import { doesModuleUseNewChildHandler } from './Connection/ApiVersions.js'
import { ConnectionChildHandlerNew } from './Connection/ChildHandlerNew.js'
import { PreserveEnvVars } from './Environment.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'

/**
 * A backoff sleep strategy
 * @returns ms to sleep
 */
function sleepStrategy(i: number): number {
	const low = 3
	const min = 1000
	const max = 60 * 1000
	if (i < low) {
		return min
	} else {
		return Math.min(Math.pow(2, i - low) * 1000, max)
	}
}

interface ModuleChild {
	moduleType: ModuleInstanceType
	instanceId: string
	logger: Logger
	restartCount: number
	isReady: boolean
	targetState: ModuleChildTargetState | null // Null if disabled
	lastLabel: string

	monitor?: RespawnMonitor
	handler?: ChildProcessHandlerBase
	lifeCycleQueue: PQueue
	authToken?: string
	crashed?: NodeJS.Timeout
	cleanupStopped?: () => void
}

interface ModuleChildTargetState {
	label: string
	moduleType: ModuleInstanceType
	moduleId: string
	moduleVersionId: string | null
}

export interface ChildProcessHandlerBase {
	/**
	 * Initialise the child process handler with configuration
	 */
	init(config: InstanceConfig): Promise<void>
	/**
	 * Initialisation is complete, and the child is marked as ready.
	 * In here you can emit events that will cause other classes to call into the child
	 */
	ready?(): Promise<void>

	/**
	 * Destroy the child process handler, cleaning up resources
	 */
	destroy(): Promise<void>
	/**
	 * Cleanup any resources after the child is already stopped
	 */
	cleanup(): void
}

export class InstanceProcessManager {
	readonly #logger = LogController.createLogger('Instance/ProcessManager')

	readonly #connectionDeps: ConnectionChildHandlerDependencies
	readonly #surfaceDeps: SurfaceChildHandlerDependencies
	readonly #modules: InstanceModules
	readonly #instanceConfigStore: InstanceConfigStore

	/**
	 * Queue for starting instances, to limit how many can be starting concurrently
	 */
	readonly #startQueue: PQueue

	#children: Map<string, ModuleChild>

	constructor(
		connectionDeps: ConnectionChildHandlerDependencies,
		surfaceDeps: SurfaceChildHandlerDependencies,
		modules: InstanceModules,
		instanceConfigStore: InstanceConfigStore
	) {
		this.#connectionDeps = connectionDeps
		this.#surfaceDeps = surfaceDeps
		this.#modules = modules
		this.#instanceConfigStore = instanceConfigStore

		const cpuCount = os.cpus().length // An approximation
		this.#startQueue = new PQueue({ concurrency: Math.max(cpuCount - 1, 1) })

		this.#children = new Map()
	}

	/**
	 * Get a handle to an active instance
	 */
	getChild(instanceId: string, allowInitialising?: boolean): ChildProcessHandlerBase | undefined {
		const child = this.#children.get(instanceId)
		if (child && (child.isReady || allowInitialising)) {
			return child.handler
		} else {
			return undefined
		}
	}

	getConnectionChild(connectionId: string, allowInitialising?: boolean): ConnectionChildHandlerApi | undefined {
		const child = this.getChild(connectionId, allowInitialising)
		if (child && isConnectionChild(child)) {
			return child
		} else {
			return undefined
		}
	}

	getSurfaceChild(connectionId: string, allowInitialising?: boolean): SurfaceChildHandler | undefined {
		const child = this.getChild(connectionId, allowInitialising)
		if (child && child instanceof SurfaceChildHandler) {
			return child
		} else {
			return undefined
		}
	}

	/**
	 * Resend feedbacks to all active instances.
	 * This will trigger a subscribe call for each feedback
	 */
	resubscribeAllFeedbacks(): void {
		for (const child of this.#children.values()) {
			if (child.handler && child.isReady && isConnectionChild(child.handler)) {
				child.handler.sendAllFeedbackInstances().catch((e) => {
					this.#logger.warn(`sendAllFeedbackInstances failed for "${child.instanceId}": ${e}`)
				})
			}
		}
	}

	/**
	 * Send a list of changed variables to all active instances.
	 * This will trigger feedbacks using variables to be rechecked
	 */
	onVariablesChanged(all_changed_variables_set: ReadonlySet<string>, fromControlId: string | null): void {
		const changedVariableIds = Array.from(all_changed_variables_set)

		for (const child of this.#children.values()) {
			if (child.handler && child.isReady && isConnectionChild(child.handler)) {
				child.handler.sendVariablesChanged(all_changed_variables_set, changedVariableIds, fromControlId).catch((e) => {
					this.#logger.warn(`sendVariablesChanged failed for "${child.instanceId}": ${e}`)
				})
			}
		}
	}

	/**
	 * Stop all running instances
	 */
	async queueStopAllInstances(): Promise<void> {
		for (const instanceId of this.#children.keys()) {
			this.queueUpdateInstanceState(instanceId, null, true)
		}

		// This is not efficient, but this is only used for shutdown, so it doesn't matter
		for (let i = 0; i < 20; i++) {
			const runningChildren = this.#children
				.values()
				.filter((c) => !!c.monitor)
				.toArray()
			if (runningChildren.length === 0) {
				// No more children running
				break
			}

			// Wait a bit for the children to stop
			await new Promise<void>((resolve) => setTimeout(resolve, 100))
		}
	}

	/**
	 * Stop an instance running
	 * @param instanceId
	 * @param allowDeleteIfEmpty delete the work-queue if it has no further jobs
	 */
	async #doStopInstanceInner(instanceId: string, allowDeleteIfEmpty: boolean): Promise<void> {
		const child = this.#children.get(instanceId)
		if (child) {
			// Ensure a new child cant register
			delete child.authToken

			child.isReady = false

			if (child.crashed) {
				clearTimeout(child.crashed)
				delete child.crashed
			}

			if (child.handler) {
				// Perform cleanup of the module and event listeners
				try {
					await child.handler.destroy()
				} catch (e) {
					console.error(`Destroy failed: ${e}`)
				}
				delete child.handler
			}

			if (child.monitor) {
				// Stop the child process
				const monitor = child.monitor
				await new Promise<void>((resolve) => monitor.stop(resolve))
				delete child.monitor
			}

			if (allowDeleteIfEmpty && child.lifeCycleQueue.size === 0) {
				// Delete the queue now that it is empty
				this.#children.delete(instanceId)
			}

			// mark instance as disabled
			this.#connectionDeps.instanceStatus.updateInstanceStatus(instanceId, null, 'Disabled')
		}
	}

	/**
	 * Update the logger label for a child process
	 */
	updateChildLabel(instanceId: string, label: string): void {
		const child = this.#children.get(instanceId)
		if (child) {
			child.lastLabel = label
			child.logger = LogController.createLogger(`Instance/Child/${label}`)
		}
	}

	/**
	 * Start or restart an instance process
	 */
	queueUpdateInstanceState(
		instanceId: string,
		targetState: ModuleChildTargetState | null,
		forceRestart: boolean
	): void {
		let baseChild = this.#children.get(instanceId)
		if (!baseChild) {
			if (!targetState) {
				// Instance is not running, nothing to do
				return
			}

			// Create a new child entry
			baseChild = {
				moduleType: targetState.moduleType,
				instanceId: instanceId,
				lifeCycleQueue: new PQueue({ concurrency: 1 }),
				logger: LogController.createLogger(`Instance/Child/${targetState.label}`),
				restartCount: 0,
				isReady: false,
				targetState: targetState,
				lastLabel: targetState.label,
			}
			this.#children.set(instanceId, baseChild)

			this.#connectionDeps.instanceStatus.updateInstanceStatus(instanceId, null, 'Starting')

			forceRestart = true // Force restart if it is a new instance
		}

		if (!forceRestart && baseChild.targetState && targetState) {
			// If the target state is the same, then don't do anything
			if (
				baseChild.targetState.moduleId === targetState.moduleId &&
				baseChild.targetState.moduleVersionId === targetState.moduleVersionId &&
				baseChild.targetState.label === targetState.label
			) {
				this.#logger.debug(`Instance "${instanceId}" already in target state, not restarting`)
				return
			}
		}

		baseChild.targetState = targetState
		if (targetState) baseChild.lastLabel = targetState.label

		if (baseChild.lifeCycleQueue.size > 0) {
			// Already a change waiting to be processed, so don't do anything
			return
		}

		// Queue the work
		baseChild.lifeCycleQueue
			.add(async () => {
				await this.#queueRestartInstanceInner(instanceId, baseChild).catch((e) => {
					this.#logger.error(`Unhandled error restarting instance: ${e}`)
				})
			})
			.catch((e) => {
				this.#logger.error(`Configured instance "${instanceId}" failed to start: `, e)
			})
	}

	async #queueRestartInstanceInner(instanceId: string, baseChild: ModuleChild) {
		// No target state, so stop the instance
		if (!baseChild.targetState) {
			this.#logger.debug(`Stopping instance: "${baseChild.lastLabel}"`)
			await this.#doStopInstanceInner(instanceId, true)
			return
		}

		// Run the start in a separate queue, to limit the concurrency
		await this.#startQueue.add(async () => {
			// If the target state is null, then a stop must be queued now, so don't try to start it
			if (!baseChild.targetState) {
				this.#logger.debug(`No target state for instance: "${baseChild.lastLabel}", not starting`)
				return
			}

			this.#logger.info(`Starting instance: ${baseChild.targetState.label}`)

			// stop any existing child process
			await this.#doStopInstanceInner(instanceId, false)

			const moduleInfo = this.#modules.getModuleManifest(
				baseChild.moduleType,
				baseChild.targetState.moduleId,
				baseChild.targetState.moduleVersionId
			)
			if (!moduleInfo) {
				this.#logger.error(
					`Configured instance "${baseChild.targetState.moduleId}" could not be loaded, unknown module`
				)
				if (this.#modules.hasModule(baseChild.moduleType, baseChild.targetState.moduleId)) {
					this.#connectionDeps.instanceStatus.updateInstanceStatus(instanceId, 'system', 'Unknown module version')
				} else {
					this.#connectionDeps.instanceStatus.updateInstanceStatus(instanceId, 'system', 'Unknown module')
				}
				return
			}

			const runtimeInfo = await this.#findAndValidateModuleInfo(moduleInfo, instanceId, baseChild.lastLabel)
			if (!runtimeInfo) return

			const nodePath = await getNodeJsPath(moduleInfo.manifest.runtime.type)
			if (!nodePath) {
				this.#logger.error(
					`Runtime "${moduleInfo.manifest.runtime.type}" is not supported in this version of Companion: "${baseChild.lastLabel}"`
				)
				return
			}

			const child = this.#children.get(instanceId)
			if (!child) {
				this.#logger.verbose(`Lost tracking object for instance: "${baseChild.lastLabel}"`)
				return
			}

			// Create the handler early, before the child process starts, to capture all messages
			if (!child.targetState) {
				this.#logger.error(`No target state for handler creation: "${child.lastLabel}"`)
				return
			}

			child.authToken = nanoid()

			// Allow running node with `--inspect`
			let inspectPort = undefined
			if (!moduleInfo.isPackaged) {
				try {
					const inspectFilePath = path.join(moduleInfo.basePath, 'DEBUG-INSPECT')
					const inspectFileStr = await fs.readFile(inspectFilePath)
					const inspectPortTmp = Number(inspectFileStr.toString().trim())
					if (!isNaN(inspectPortTmp)) inspectPort = inspectPortTmp
				} catch (_e) {
					// Ignore
				}
			}

			const enableInspect = inspectPort !== undefined
			if (enableInspect) {
				this.#connectionDeps.debugLogLine(
					instanceId,
					Date.now(),
					'System',
					'error',
					`** Disabling permissions model to enable inspector **\nMake sure to re-test the module without the inspector enabled before releasing`
				)
			}

			const cmd: string[] = [
				nodePath,
				...getNodeJsPermissionArguments(
					moduleInfo.manifest,
					runtimeInfo.apiVersion,
					moduleInfo.basePath,
					enableInspect
				),
				enableInspect ? `--inspect=${inspectPort}` : undefined,
				runtimeInfo.entrypoint,
			].filter((v): v is string => !!v)
			this.#logger.debug(`Instance "${baseChild.targetState.label}" command: ${JSON.stringify(cmd)}`)

			this.#connectionDeps.debugLogLine(
				instanceId,
				Date.now(),
				'System',
				'system',
				`** Starting Instance from "${runtimeInfo.moduleEntrypoint}" **`
			)
			this.#connectionDeps.debugLogLine(
				instanceId,
				Date.now(),
				'System',
				'system',
				`** API version: ${runtimeInfo.apiVersion} **`
			)

			const monitor = new RespawnMonitor(cmd, {
				env: {
					...PreserveEnvVars(),
					VERIFICATION_TOKEN: child.authToken,
					MODULE_MANIFEST: 'companion/manifest.json',
					...runtimeInfo.env,
				},
				maxRestarts: -1,
				kill: 5000,
				cwd: moduleInfo.basePath,
				fork: false,
				stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
			})

			monitor.on('start', () => {
				child.isReady = false
				child.handler?.cleanup()

				child.logger.info(`Process started process ${monitor.child?.pid}`)
				this.#connectionDeps.debugLogLine(instanceId, Date.now(), 'System', 'system', '** Process started **')
			})
			monitor.on('stop', () => {
				child.isReady = false
				child.handler?.cleanup()

				this.#connectionDeps.instanceStatus.updateInstanceStatus(
					instanceId,
					child.crashed ? 'crashed' : null,
					child.crashed ? '' : 'Stopped'
				)
				child.logger.debug(`Process stopped`)
				this.#connectionDeps.debugLogLine(instanceId, Date.now(), 'System', 'system', '** Process stopped **')
			})
			monitor.on('crash', () => {
				child.isReady = false
				child.handler?.cleanup()

				this.#connectionDeps.instanceStatus.updateInstanceStatus(instanceId, null, 'Crashed')
				child.logger.debug(`Process crashed`)
				this.#connectionDeps.debugLogLine(instanceId, Date.now(), 'System', 'system', '** Process crashed **')
			})
			monitor.on('stdout', (data) => {
				if (moduleInfo.versionId === 'dev') {
					// Only show stdout for modules which are being developed
					child.logger.verbose(`stdout: ${data.toString()}`)
				}

				this.#connectionDeps.debugLogLine(instanceId, Date.now(), 'Console', 'console', data.toString())
			})
			monitor.on('stderr', (data) => {
				const str = data.toString()
				child.logger.verbose(`stderr: ${str}`)
				this.#connectionDeps.debugLogLine(instanceId, Date.now(), 'Console', 'error', str)
			})

			child.monitor = monitor

			// Create handler and wait for registration + initialization
			try {
				await this.#createHandlerAndWaitForInit(child, monitor, runtimeInfo, moduleInfo)
			} catch (error) {
				this.#logger.error(`Failed to initialize instance "${child.lastLabel}": ${error}`)
				throw error
			}

			// Sleep for a tick
			await new Promise((resolve) => setImmediate(resolve))
		})
	}

	async #createHandlerAndWaitForInit(
		child: ModuleChild,
		monitor: RespawnMonitor,
		runtimeInfo: RuntimeInfo,
		moduleInfo: SomeModuleVersionInfo
	): Promise<void> {
		if (!child.targetState) {
			throw new Error('No target state')
		}

		// Create a promise that will be resolved when registration completes
		const { promise: initPromise, resolve: resolveInit, reject: rejectInit } = Promise.withResolvers<void>()

		const forceRestart = () => {
			// Force restart the instance, as it failed to initialise and will be broken
			child.restartCount++

			monitor.off('exit', forceRestart)

			// Report the failure
			rejectInit(new Error('Restart forced'))

			const sleepDuration = sleepStrategy(child.restartCount)
			if (!child.crashed && child.targetState) {
				child.crashed = setTimeout(() => {
					// Restart after a short sleep
					this.queueUpdateInstanceState(child.instanceId, child.targetState, true)
				}, sleepDuration)
			}

			// Stop it now
			monitor.stop()
			child.handler?.cleanup()
			delete child.handler
		}
		monitor.on('exit', forceRestart)

		// Registration callback - called by handler when child process registers
		let hasRegistered = false
		const onRegisterReceived = async (verificationToken: string): Promise<void> => {
			if (hasRegistered) {
				this.#logger.debug(`Duplicate register received for instance: "${child.lastLabel}"`)
				return
			}
			hasRegistered = true

			if (child.authToken !== verificationToken) {
				this.#logger.debug(`Got register with bad auth token for instance: "${child.lastLabel}"`)
				forceRestart()
				return
			}

			if (child.crashed) {
				// Clear existing restart timer
				clearTimeout(child.crashed)
				delete child.crashed
			}

			if (!child.monitor || !child.monitor.child) {
				this.#logger.debug(`Got register with child not initialised: "${child.lastLabel}"`)
				forceRestart()
				return
			}

			if (!child.targetState) {
				this.#logger.debug(`Got register with no target state: "${child.lastLabel}"`)
				forceRestart()
				return
			}

			// Register successful
			this.#logger.debug(`Registered module client "${child.lastLabel}"`)

			// TODO module-lib - can we get this in a cleaner way?
			const config = this.#instanceConfigStore.getConfigOfTypeForId(child.instanceId, child.moduleType)
			if (!config) {
				this.#logger.verbose(`Missing config for instance "${child.lastLabel}"`)
				forceRestart()
				return
			}

			// Defer to allow the message to respond
			const handler = child.handler
			setImmediate(() => {
				// Verify still the same handler
				if (child.handler !== handler) return
				if (!child.handler) {
					this.#logger.debug(`Handler disappeared for instance "${child.lastLabel}"`)
					forceRestart()
					return
				}

				// Init module
				this.#connectionDeps.instanceStatus.updateInstanceStatus(child.instanceId, 'initializing', null)

				child.handler
					.init(config)
					.then(async () => {
						child.restartCount = 0

						// mark child as ready to receive
						child.isReady = true

						// Call ready hook
						await child.handler?.ready?.()

						resolveInit()
					})
					.catch((e) => {
						this.#logger.warn(`Instance "${config.label || child.instanceId}" failed to init: ${e} ${e?.stack}`)
						this.#connectionDeps.debugLogLine(
							child.instanceId,
							Date.now(),
							'System',
							'error',
							`Failed to init: ${e} ${e?.stack}`
						)

						forceRestart()
					})
			})
		}

		// Bind the event listeners
		switch (child.targetState.moduleType) {
			case ModuleInstanceType.Connection:
				if (doesModuleUseNewChildHandler(runtimeInfo.apiVersion)) {
					child.handler = new ConnectionChildHandlerNew(
						this.#connectionDeps,
						monitor,
						child.instanceId,
						runtimeInfo.apiVersion,
						onRegisterReceived
					)
				} else {
					child.handler = new ConnectionChildHandlerLegacy(
						this.#connectionDeps,
						monitor,
						child.instanceId,
						runtimeInfo.apiVersion,
						onRegisterReceived
					)
				}
				break
			case ModuleInstanceType.Surface:
				child.handler = new SurfaceChildHandler(
					this.#surfaceDeps,
					monitor,
					child.targetState.moduleId,
					child.instanceId,
					moduleInfo.manifest as SurfaceModuleManifest,
					onRegisterReceived
				)
				break
			default:
				assertNever(child.targetState.moduleType)
				this.#logger.debug(
					`Got register with unknown module type "${child.targetState.moduleType}" for "${child.lastLabel}"`
				)
				forceRestart()
				return
		}

		// Start the child
		monitor.start()

		// Wait for registration and initialization to complete
		await initPromise
	}

	async #findAndValidateModuleInfo(
		moduleInfo: SomeModuleVersionInfo,
		instanceId: string,
		lastLabel: string
	): Promise<{
		entrypoint: string
		moduleEntrypoint: string
		apiVersion: string
		env: Record<string, string>
	} | null> {
		const jsPath = path.join('companion', moduleInfo.manifest.runtime.entrypoint.replace(/\\/g, '/'))
		const jsFullPath = path.normalize(path.join(moduleInfo.basePath, jsPath))
		if (!(await fs.pathExists(jsFullPath))) {
			this.#logger.error(`Module entrypoint "${jsFullPath}" does not exist`)
			return null
		}

		const moduleType = moduleInfo.type
		switch (moduleInfo.type) {
			case ModuleInstanceType.Connection: {
				if (moduleInfo.manifest.runtime.api !== 'nodejs-ipc') {
					this.#logger.error(`Only nodejs-ipc api is supported currently: "${lastLabel}"`)
					return null
				}

				// Determine the module api version
				let moduleApiVersion = moduleInfo.manifest.runtime.apiVersion
				if (!moduleInfo.isPackaged) {
					// When not packaged, lookup the version from the library itself
					try {
						const require = createRequire(moduleInfo.basePath)

						const moduleLibPackagePath = require.resolve('@companion-module/base/package.json', {
							paths: [moduleInfo.basePath],
						})
						const moduleLibPackage = JSON.parse(await fs.readFile(moduleLibPackagePath, 'utf-8'))
						moduleApiVersion = moduleLibPackage.version
					} catch (e) {
						this.#logger.error(`Failed to get module api version: "${lastLabel}" ${e}`)
						return null
					}
				}

				if (!isModuleApiVersionCompatible(moduleApiVersion)) {
					this.#logger.error(`Module Api version is too new/old: "${lastLabel}" ${moduleApiVersion}`)
					return null
				}

				if (doesModuleUseNewChildHandler(moduleApiVersion)) {
					return {
						apiVersion: moduleApiVersion,
						entrypoint: path.join(
							import.meta.dirname,
							isPackaged() ? './ConnectionThread.js' : './Connection/Thread/Entrypoint.js'
						),
						moduleEntrypoint: jsFullPath,
						env: {
							MODULE_ENTRYPOINT: jsFullPath,
						},
					}
				} else {
					return {
						apiVersion: moduleApiVersion,
						entrypoint: jsFullPath,
						moduleEntrypoint: jsFullPath,
						env: {
							CONNECTION_ID: instanceId,
						},
					}
				}
			}
			case ModuleInstanceType.Surface: {
				// Determine the module api version
				let moduleApiVersion = moduleInfo.manifest.runtime.apiVersion
				if (!moduleInfo.isPackaged) {
					// When not packaged, lookup the version from the library itself
					try {
						const require = createRequire(moduleInfo.basePath)

						const moduleLibPackagePath = require.resolve('@companion-surface/base/package.json', {
							paths: [moduleInfo.basePath],
						})
						const moduleLibPackage = JSON.parse(await fs.readFile(moduleLibPackagePath, 'utf-8'))
						moduleApiVersion = moduleLibPackage.version
					} catch (e) {
						this.#logger.error(`Failed to get module api version: "${lastLabel}" ${e}`)
						return null
					}
				}

				if (!isSurfaceApiVersionCompatible(moduleApiVersion)) {
					this.#logger.error(`Module Api version is too new/old: "${lastLabel}" ${moduleApiVersion}`)
					return null
				}

				return {
					apiVersion: moduleApiVersion,
					entrypoint: path.join(
						import.meta.dirname,
						isPackaged() ? './SurfaceThread.js' : './Surface/Thread/Entrypoint.js'
					),
					moduleEntrypoint: jsFullPath,
					env: {
						MODULE_ENTRYPOINT: jsFullPath,
					},
				}
			}
			default:
				assertNever(moduleInfo)
				this.#logger.error(`Unknown module type "${moduleType}" for api version check: "${lastLabel}"`)
				return null
		}
	}

	async connectionEntityUpdate(entity: ControlEntityInstance, controlId: string): Promise<boolean> {
		const connection = this.getConnectionChild(entity.connectionId, true)
		if (!connection) return false

		await connection.entityUpdate(entity, controlId)

		return true
	}
	async connectionEntityDelete(entityModel: SomeEntityModel, _controlId: string): Promise<boolean> {
		const connection = this.getConnectionChild(entityModel.connectionId, true)
		if (!connection) return false

		await connection.entityDelete(entityModel)

		return true
	}
	async connectionEntityLearnOptions(
		entityModel: SomeEntityModel,
		controlId: string
	): Promise<ExpressionableOptionsObject | undefined | void> {
		const connection = this.getConnectionChild(entityModel.connectionId)
		if (!connection) return undefined

		return connection.entityLearnValues(entityModel, controlId)
	}
}

interface RuntimeInfo {
	entrypoint: string
	apiVersion: string
	env: Record<string, string>
}

function isConnectionChild(handler: ChildProcessHandlerBase): handler is ConnectionChildHandlerApi {
	return !!handler && (handler instanceof ConnectionChildHandlerLegacy || handler instanceof ConnectionChildHandlerNew)
}
