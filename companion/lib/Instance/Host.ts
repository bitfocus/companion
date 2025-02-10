import LogController, { Logger } from '../Log/Controller.js'
import PQueue from 'p-queue'
import { nanoid } from 'nanoid'
import path from 'path'
import { InstanceModuleWrapperDependencies, SocketEventsHandler } from './Wrapper.js'
import fs from 'fs-extra'
import ejson from 'ejson'
import os from 'os'
import { getNodeJsPath } from './NodePath.js'
import { RespawnMonitor } from '@companion-app/shared/Respawn.js'
import type { ConnectionConfig } from '@companion-app/shared/Model/Connections.js'
import type { InstanceModules, ModuleInfo } from './Modules.js'
import type { ConnectionConfigStore } from './ConnectionConfigStore.js'
import { isModuleApiVersionCompatible } from '@companion-app/shared/ModuleApiVersionCheck.js'
import { Serializable } from 'child_process'

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

/**
 *
 */
export function ConnectionDebugLogRoom(id: string): `connection-debug:update:${string}` {
	return `connection-debug:update:${id}`
}

interface ModuleChild {
	connectionId: string
	logger: Logger
	restartCount: number
	isReady: boolean
	monitor?: RespawnMonitor
	handler?: SocketEventsHandler
	lifeCycleQueue: PQueue
	authToken?: string
	crashed?: NodeJS.Timeout
	skipApiVersionCheck?: boolean
}

export class ModuleHost {
	readonly #logger = LogController.createLogger('Instance/ModuleHost')

	readonly #deps: InstanceModuleWrapperDependencies
	readonly #modules: InstanceModules
	readonly #connectionConfigStore: ConnectionConfigStore

	/**
	 * Queue for starting connections, to limit how many can be starting concurrently
	 */
	readonly #startQueue: PQueue

	#children: Map<string, ModuleChild>

	constructor(
		deps: InstanceModuleWrapperDependencies,
		modules: InstanceModules,
		connectionConfigStore: ConnectionConfigStore
	) {
		this.#deps = deps
		this.#modules = modules
		this.#connectionConfigStore = connectionConfigStore

		const cpuCount = os.cpus().length // An approximation
		this.#startQueue = new PQueue({ concurrency: Math.max(cpuCount - 1, 1) })

		this.#children = new Map()
	}

	/**
	 * Bind events/initialise a connected child process
	 */
	#listenToModuleSocket(child: ModuleChild, startupCompleted: () => void, startupFailed: (err: Error) => void): void {
		const forceRestart = () => {
			// Force restart the connection, as it failed to initialise and will be broken
			child.restartCount++

			child.monitor?.off('exit', forceRestart)
			child.monitor?.off('message', initHandler)

			// Report the failure
			startupFailed(new Error('Restart forced'))

			const sleepDuration = sleepStrategy(child.restartCount)
			if (!child.crashed) {
				child.crashed = setTimeout(() => {
					const config = this.#connectionConfigStore.getConfigForId(child.connectionId)
					const moduleInfo = config && this.#modules.getModuleManifest(config.instance_type)

					// Restart after a short sleep
					this.queueRestartConnection(child.connectionId, config, moduleInfo)
				}, sleepDuration)
			}

			// Stop it now
			child.monitor?.stop()
			child.handler?.cleanup()
			delete child.handler
		}

		const debugLogRoom = ConnectionDebugLogRoom(child.connectionId)

		const initHandler = (msg0: Serializable): void => {
			const msg = msg0 as Record<string, any>
			if (msg.direction === 'call' && msg.name === 'register' && msg.callbackId && msg.payload) {
				const { apiVersion, connectionId, verificationToken } = ejson.parse(msg.payload)
				if (!child.skipApiVersionCheck && !isModuleApiVersionCompatible(apiVersion)) {
					this.#logger.debug(`Got register for unsupported api version "${apiVersion}" connectionId: "${connectionId}"`)
					this.#deps.io.emitToRoom(
						debugLogRoom,
						debugLogRoom,
						'error',
						`Got register for unsupported api version "${apiVersion}"`
					)

					forceRestart()
					return
				}

				if (child.authToken !== verificationToken) {
					this.#logger.debug(`Got register with bad auth token for connectionId: "${connectionId}"`)
					forceRestart()
					return
				}

				if (child.crashed) {
					// Clear existing restart timer
					clearTimeout(child.crashed)
					delete child.crashed
				}

				if (!child.monitor || !child.monitor.child) {
					this.#logger.debug(`Got register with child not initialised: "${connectionId}"`)
					forceRestart()
					return
				}

				// Bind the event listeners
				child.handler = new SocketEventsHandler(this.#deps, child.monitor, connectionId, apiVersion)

				// Register successful
				// child.doWorkTask = registerResult.doWorkTask
				this.#logger.debug(`Registered module client "${connectionId}"`)

				// TODO module-lib - can we get this in a cleaner way?
				const config = this.#connectionConfigStore.getConfigForId(child.connectionId)
				if (!config) {
					this.#logger.verbose(`Missing config for instance "${connectionId}"`)
					forceRestart()
					return
				}
				// const moduleInfo = this.registry.instance.modules.known_modules[config.instance_type]
				// if (!moduleInfo) {
				// 	this.#logger.verbose(`Missing manifest for instance "${connectionId}"`)
				// 	forceRestart()
				// 	return
				// }

				// report success
				child.monitor.child.send({
					direction: 'response',
					callbackId: msg.callbackId,
					success: true,
					payload: ejson.stringify({}),
				})

				// TODO module-lib - start pings

				// Init module
				this.#deps.instanceStatus.updateInstanceStatus(connectionId, 'initializing', null)

				child.handler
					.init(config)
					.then(() => {
						child.restartCount = 0

						child.monitor?.off('exit', forceRestart)
						child.monitor?.off('message', initHandler)

						startupCompleted()

						// mark child as ready to receive
						child.isReady = true

						// Inform action recorder
						this.#deps.controls.actionRecorder.connectionAvailabilityChange(connectionId, true)
					})
					.catch((e) => {
						this.#logger.warn(`Instance "${config.label || child.connectionId}" failed to init: ${e} ${e?.stack}`)
						this.#deps.io.emitToRoom(debugLogRoom, debugLogRoom, 'error', `Failed to init: ${e} ${e?.stack}`)

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
	getChild(connectionId: string, allowInitialising?: boolean): SocketEventsHandler | undefined {
		const child = this.#children.get(connectionId)
		if (child && (child.isReady || allowInitialising)) {
			return child.handler
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
			if (child.handler && child.isReady) {
				child.handler.sendAllFeedbackInstances().catch((e) => {
					this.#logger.warn(`sendAllFeedbackInstances failed for "${child.connectionId}": ${e}`)
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
			if (child.handler && child.isReady) {
				child.handler.sendVariablesChanged(changedVariableIds).catch((e) => {
					this.#logger.warn(`sendVariablesChanged failed for "${child.connectionId}": ${e}`)
				})
			}
		}
	}

	/**
	 * Stop all running instances
	 */
	async queueStopAllConnections(): Promise<void> {
		const ps: Promise<void>[] = []

		for (const connectionId of this.#children.keys()) {
			ps.push(this.queueStopConnection(connectionId))
		}

		await Promise.all(ps)
	}

	/**
	 * Stop an instance process/thread
	 */
	async queueStopConnection(connectionId: string): Promise<void> {
		const child = this.#children.get(connectionId)
		if (child) {
			await child.lifeCycleQueue.add(async () => this.#doStopConnectionInner(connectionId, true))
		}
	}

	/**
	 * Stop an instance running
	 * @param connectionId
	 * @param allowDeleteIfEmpty delete the work-queue if it has no further jobs
	 */
	async #doStopConnectionInner(connectionId: string, allowDeleteIfEmpty: boolean): Promise<void> {
		const child = this.#children.get(connectionId)
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
				this.#children.delete(connectionId)
			}

			// mark connection as disabled
			this.#deps.instanceStatus.updateInstanceStatus(connectionId, null, 'Disabled')
		}
	}

	/**
	 * Update the logger label for a child process
	 */
	updateChildLabel(connectionId: string, label: string): void {
		const child = this.#children.get(connectionId)
		if (child) {
			child.logger = LogController.createLogger(`Instance/${label}`)
		}
	}

	/**
	 * Start or restart an instance process
	 */
	async queueRestartConnection(
		connectionId: string,
		config: ConnectionConfig | undefined,
		moduleInfo: ModuleInfo | undefined
	): Promise<void> {
		if (!config || !moduleInfo) return

		let child = this.#children.get(connectionId)
		if (!child) {
			// Create a new child entry
			child = {
				connectionId,
				lifeCycleQueue: new PQueue({ concurrency: 1 }),
				logger: LogController.createLogger(`Instance/${config.label}`),
				restartCount: 0,
				isReady: false,
			}
			this.#children.set(connectionId, child)
		}

		await child.lifeCycleQueue.add(async () => {
			// Run the start in a separate queue, to limit the concurrency
			await this.#startQueue
				.add(async () => {
					if (config && config.enabled !== false) {
						this.#logger.info(`Starting connection: "${config.label}" (${connectionId})`)

						// stop any existing child process
						await this.#doStopConnectionInner(connectionId, false)

						if (moduleInfo.manifest.runtime.api !== 'nodejs-ipc') {
							this.#logger.error(`Only nodejs-ipc api is supported currently: "${connectionId}"`)
							return
						}

						const nodePath = await getNodeJsPath(moduleInfo.manifest.runtime.type)
						if (!nodePath) {
							this.#logger.error(
								`Runtime "${moduleInfo.manifest.runtime.type}" is not supported in this version of Companion: "${connectionId}"`
							)
							return
						}

						if (moduleInfo.isPackaged && !isModuleApiVersionCompatible(moduleInfo.manifest.runtime.apiVersion)) {
							this.#logger.error(
								`Module Api version is too new/old: "${connectionId}" ${moduleInfo.manifest.runtime.apiVersion}`
							)
							return
						}

						const child = this.#children.get(connectionId)
						if (!child) {
							this.#logger.verbose(`Lost tracking object for connection: "${connectionId}"`)
							return
						}

						child.authToken = nanoid()
						child.skipApiVersionCheck = !moduleInfo.isPackaged

						const jsPath = path.join('companion', moduleInfo.manifest.runtime.entrypoint)
						const jsFullPath = path.join(moduleInfo.basePath, jsPath)
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
							} catch (e) {
								// Ignore
							}
						}

						const cmd: string[] = [
							nodePath,
							inspectPort !== undefined ? `--inspect=${inspectPort}` : undefined,
							jsPath,
						].filter((v): v is string => !!v)
						this.#logger.silly(`Connection "${config.label}" command: ${JSON.stringify(cmd)}`)

						const monitor = new RespawnMonitor(cmd, {
							// name: `Connection "${config.label}"(${connectionId})`,
							env: {
								CONNECTION_ID: connectionId,
								VERIFICATION_TOKEN: child.authToken,
								MODULE_MANIFEST: 'companion/manifest.json',

								// Provide sentry details
								// SENTRY_DSN:
								// SENTRY_USERID:
								// SENTRY_COMPANION_VERSION:
							},
							maxRestarts: -1,
							kill: 5000,
							cwd: moduleInfo.basePath,
							fork: false,
							stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
						})

						const debugLogRoom = ConnectionDebugLogRoom(connectionId)
						this.#deps.io.emitToRoom(
							debugLogRoom,
							debugLogRoom,
							'system',
							`** Starting Connection from "${path.join(moduleInfo.basePath, jsPath)}" **`
						)

						monitor.on('start', () => {
							child.isReady = false
							child.handler?.cleanup()

							this.#logger.debug(`Connection "${config.label}" started`)
							this.#deps.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection started **')
						})
						monitor.on('stop', () => {
							child.isReady = false
							child.handler?.cleanup()

							this.#deps.instanceStatus.updateInstanceStatus(
								connectionId,
								child.crashed ? 'crashed' : null,
								child.crashed ? '' : 'Stopped'
							)
							this.#logger.debug(`Connection "${config.label}" stopped`)
							this.#deps.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection stopped **')

							this.#deps.controls.actionRecorder.connectionAvailabilityChange(connectionId, false)
						})
						monitor.on('crash', () => {
							child.isReady = false
							child.handler?.cleanup()

							this.#deps.instanceStatus.updateInstanceStatus(connectionId, null, 'Crashed')
							this.#logger.debug(`Connection "${config.label}" crashed`)
							this.#deps.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection crashed **')
						})
						monitor.on('stdout', (data) => {
							if (!moduleInfo.isPackaged) {
								// Only show stdout for modules which are being developed
								child.logger.verbose(`stdout: ${data.toString()}`)
							}

							if (this.#deps.io.countRoomMembers(debugLogRoom) > 0) {
								this.#deps.io.emitToRoom(debugLogRoom, debugLogRoom, 'console', data.toString())
							}
						})
						monitor.on('stderr', (data) => {
							child.logger.verbose(`stderr: ${data.toString()}`)
							if (this.#deps.io.countRoomMembers(debugLogRoom) > 0) {
								this.#deps.io.emitToRoom(debugLogRoom, debugLogRoom, 'error', data.toString())
							}
						})

						child.monitor = monitor

						const initialisedPromise = new Promise<void>((resolve, reject) => {
							this.#listenToModuleSocket(child, resolve, reject)
						})

						// Start the child
						child.monitor.start()

						// Wait for init to complete, or fail
						await initialisedPromise
						// Sleep for a tick
						await new Promise((resolve) => setImmediate(resolve))

						// TODO module-lib - timeout for first contact
					} else {
						this.#logger.debug(`Attempting to start missing connection: "${connectionId}"`)
						await this.#doStopConnectionInner(connectionId, true)
					}
				})
				.catch((e) => {
					this.#logger.error(`Unhandled error restarting connection: ${e}`)
				})
		})
	}
}
