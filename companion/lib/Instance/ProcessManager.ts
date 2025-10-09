import LogController, { Logger } from '../Log/Controller.js'
import PQueue from 'p-queue'
import { nanoid } from 'nanoid'
import path from 'path'
import { ConnectionChildHandlerDependencies, ConnectionChildHandler } from './Connection/ChildHandler.js'
import fs from 'fs-extra'
import ejson from 'ejson'
import os from 'os'
import { getNodeJsPath, getNodeJsPermissionArguments } from './NodePath.js'
import { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import type { InstanceModules } from './Modules.js'
import type { InstanceConfigStore } from './ConfigStore.js'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import type { SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import { CompanionOptionValues } from '@companion-module/base'
import { Serializable } from 'child_process'
import { createRequire } from 'module'
import type { ControlEntityInstance } from '../Controls/Entities/EntityInstance.js'
import { InstanceConfig, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { assertNever } from '@companion-app/shared/Util.js'

const require = createRequire(import.meta.url)

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
	init(config: InstanceConfig): Promise<void>

	destroy(): Promise<void>
	cleanup(): void
}

export class InstanceProcessManager {
	readonly #logger = LogController.createLogger('Instance/ProcessManager')

	readonly #deps: ConnectionChildHandlerDependencies
	readonly #modules: InstanceModules
	readonly #InstanceConfigStore: InstanceConfigStore

	/**
	 * Queue for starting instances, to limit how many can be starting concurrently
	 */
	readonly #startQueue: PQueue

	#children: Map<string, ModuleChild>

	constructor(
		deps: ConnectionChildHandlerDependencies,
		modules: InstanceModules,
		InstanceConfigStore: InstanceConfigStore
	) {
		this.#deps = deps
		this.#modules = modules
		this.#InstanceConfigStore = InstanceConfigStore

		const cpuCount = os.cpus().length // An approximation
		this.#startQueue = new PQueue({ concurrency: Math.max(cpuCount - 1, 1) })

		this.#children = new Map()
	}

	/**
	 * Bind events/initialise a connected child process
	 */
	#listenToModuleSocket(
		child: ModuleChild,
		apiVersion: string,
		startupCompleted: () => void,
		startupFailed: (err: Error) => void
	): void {
		const forceRestart = () => {
			// Force restart the instance, as it failed to initialise and will be broken
			child.restartCount++

			child.monitor?.off('exit', forceRestart)
			child.monitor?.off('message', initHandler)

			// Report the failure
			startupFailed(new Error('Restart forced'))

			const sleepDuration = sleepStrategy(child.restartCount)
			if (!child.crashed && child.targetState) {
				child.crashed = setTimeout(() => {
					// Restart after a short sleep
					this.queueUpdateInstanceState(child.instanceId, child.targetState, true)
				}, sleepDuration)
			}

			// Stop it now
			child.monitor?.stop()
			child.handler?.cleanup()
			delete child.handler
		}

		const initHandler = (msg0: Serializable): void => {
			const msg = msg0 as Record<string, any>
			if (msg.direction === 'call' && msg.name === 'register' && msg.callbackId && msg.payload) {
				const { verificationToken } = ejson.parse(msg.payload)

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

				// Bind the event listeners
				switch (child.targetState.moduleType) {
					case ModuleInstanceType.Connection:
						child.handler = new ConnectionChildHandler(this.#deps, child.monitor, child.instanceId, apiVersion)
						break
					default:
						assertNever(child.targetState.moduleType)
						this.#logger.debug(
							`Got register with unknown module type "${child.targetState.moduleType}" for "${child.lastLabel}"`
						)
						forceRestart()
						return
				}

				// Register successful
				// child.doWorkTask = registerResult.doWorkTask
				this.#logger.debug(`Registered module client "${child.lastLabel}"`)

				// TODO module-lib - can we get this in a cleaner way?
				const config = this.#InstanceConfigStore.getConfigOfTypeForId(child.instanceId, child.moduleType)
				if (!config) {
					this.#logger.verbose(`Missing config for instance "${child.lastLabel}"`)
					forceRestart()
					return
				}

				// report success
				child.monitor.child.send({
					direction: 'response',
					callbackId: msg.callbackId,
					success: true,
					payload: ejson.stringify({}),
				})

				// TODO module-lib - start pings

				// Init module
				this.#deps.instanceStatus.updateInstanceStatus(child.instanceId, 'initializing', null)

				child.handler
					.init(config)
					.then(() => {
						child.restartCount = 0

						child.monitor?.off('message', initHandler)

						startupCompleted()

						// mark child as ready to receive
						child.isReady = true
					})
					.catch((e) => {
						this.#logger.warn(`Instance "${config.label || child.instanceId}" failed to init: ${e} ${e?.stack}`)
						this.#deps.debugLogLine(child.instanceId, 'error', `Failed to init: ${e} ${e?.stack}`)

						forceRestart()
					})
			}
		}
		child.monitor?.on('message', initHandler)
		child.monitor?.on('exit', forceRestart)
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

	getConnectionChild(connectionId: string, allowInitialising?: boolean): ConnectionChildHandler | undefined {
		const child = this.getChild(connectionId, allowInitialising)
		if (child && child instanceof ConnectionChildHandler) {
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
			if (child.handler && child.isReady && child.handler instanceof ConnectionChildHandler) {
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
	onVariablesChanged(all_changed_variables_set: Set<string>): void {
		const changedVariableIds = Array.from(all_changed_variables_set)

		for (const child of this.#children.values()) {
			if (child.handler && child.isReady && child.handler instanceof ConnectionChildHandler) {
				child.handler.sendVariablesChanged(all_changed_variables_set, changedVariableIds).catch((e) => {
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
			const runningChildren = Array.from(this.#children.values()).filter((c) => !!c.monitor)
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
			}

			if (child.monitor) {
				// Stop the child process
				const monitor = child.monitor
				await new Promise<void>((resolve) => monitor.stop(resolve))
			}

			if (allowDeleteIfEmpty && child.lifeCycleQueue.size === 0) {
				// Delete the queue now that it is empty
				this.#children.delete(instanceId)
			}

			// mark instance as disabled
			this.#deps.instanceStatus.updateInstanceStatus(instanceId, null, 'Disabled')
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

			this.#deps.instanceStatus.updateInstanceStatus(instanceId, null, 'Starting')

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
					this.#deps.instanceStatus.updateInstanceStatus(instanceId, 'system', 'Unknown module version')
				} else {
					this.#deps.instanceStatus.updateInstanceStatus(instanceId, 'system', 'Unknown module')
				}
				return
			}

			if (moduleInfo.type === ModuleInstanceType.Connection && moduleInfo.manifest.runtime.api !== 'nodejs-ipc') {
				this.#logger.error(`Only nodejs-ipc api is supported currently: "${baseChild.lastLabel}"`)
				return
			}

			const nodePath = await getNodeJsPath(moduleInfo.manifest.runtime.type)
			if (!nodePath) {
				this.#logger.error(
					`Runtime "${moduleInfo.manifest.runtime.type}" is not supported in this version of Companion: "${baseChild.lastLabel}"`
				)
				return
			}

			// Determine the module api version
			let moduleApiVersion = moduleInfo.manifest.runtime.apiVersion
			if (!moduleInfo.isPackaged) {
				// When not packaged, lookup the version from the library itself
				try {
					const moduleLibPackagePath = require.resolve('@companion-module/base/package.json', {
						paths: [moduleInfo.basePath],
					})
					const moduleLibPackage = require(moduleLibPackagePath)
					moduleApiVersion = moduleLibPackage.version
				} catch (e) {
					this.#logger.error(`Failed to get module api version: "${baseChild.lastLabel}" ${e}`)
					return
				}
			}

			if (!isModuleApiVersionCompatible(moduleApiVersion)) {
				this.#logger.error(`Module Api version is too new/old: "${baseChild.lastLabel}" ${moduleApiVersion}`)
				return
			}

			const child = this.#children.get(instanceId)
			if (!child) {
				this.#logger.verbose(`Lost tracking object for instance: "${baseChild.lastLabel}"`)
				return
			}

			child.authToken = nanoid()

			const jsPath = path.join('companion', moduleInfo.manifest.runtime.entrypoint.replace(/\\/g, '/'))
			const jsFullPath = path.normalize(path.join(moduleInfo.basePath, jsPath))
			if (!(await fs.pathExists(jsFullPath))) {
				this.#logger.error(`Module entrypoint "${jsFullPath}" does not exist`)
				return
			}

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
				this.#deps.debugLogLine(
					instanceId,
					'error',
					`** Disabling permissions model to enable inspector **\nMake sure to re-test the module without the inspector enabled before releasing`
				)
			}

			const cmd: string[] = [
				nodePath,
				...getNodeJsPermissionArguments(moduleInfo.manifest, moduleApiVersion, moduleInfo.basePath, enableInspect),
				enableInspect ? `--inspect=${inspectPort}` : undefined,
				jsPath,
			].filter((v): v is string => !!v)
			this.#logger.debug(`Instance "${baseChild.targetState.label}" command: ${JSON.stringify(cmd)}`)

			this.#deps.debugLogLine(
				instanceId,
				'system',
				`** Starting Instance from "${path.join(moduleInfo.basePath, jsPath)}" **`
			)

			const monitor = new RespawnMonitor(cmd, {
				env: {
					CONNECTION_ID: instanceId,
					VERIFICATION_TOKEN: child.authToken,
					MODULE_MANIFEST: 'companion/manifest.json',
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
				this.#deps.debugLogLine(instanceId, 'system', '** Process started **')
			})
			monitor.on('stop', () => {
				child.isReady = false
				child.handler?.cleanup()

				this.#deps.instanceStatus.updateInstanceStatus(
					instanceId,
					child.crashed ? 'crashed' : null,
					child.crashed ? '' : 'Stopped'
				)
				child.logger.debug(`Process stopped`)
				this.#deps.debugLogLine(instanceId, 'system', '** Process stopped **')
			})
			monitor.on('crash', () => {
				child.isReady = false
				child.handler?.cleanup()

				this.#deps.instanceStatus.updateInstanceStatus(instanceId, null, 'Crashed')
				child.logger.debug(`Process crashed`)
				this.#deps.debugLogLine(instanceId, 'system', '** Process crashed **')
			})
			monitor.on('stdout', (data) => {
				if (moduleInfo.versionId === 'dev') {
					// Only show stdout for modules which are being developed
					child.logger.verbose(`stdout: ${data.toString()}`)
				}

				this.#deps.debugLogLine(instanceId, 'console', data.toString())
			})
			monitor.on('stderr', (data) => {
				child.logger.verbose(`stderr: ${data.toString()}`)
				this.#deps.debugLogLine(instanceId, 'error', data.toString())
			})

			child.monitor = monitor

			const initialisedPromise = new Promise<void>((resolve, reject) => {
				this.#listenToModuleSocket(child, moduleApiVersion, resolve, reject)
			})

			// Start the child
			child.monitor.start()

			// Wait for init to complete, or fail
			await initialisedPromise
			// Sleep for a tick
			await new Promise((resolve) => setImmediate(resolve))

			// TODO module-lib - timeout for first contact
		})
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
	): Promise<CompanionOptionValues | undefined | void> {
		const connection = this.getConnectionChild(entityModel.connectionId)
		if (!connection) return undefined

		return connection.entityLearnValues(entityModel, controlId)
	}
}
