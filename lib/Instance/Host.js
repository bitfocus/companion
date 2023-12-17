import LogController from '../Log/Controller.js'
import PQueue from 'p-queue'
// @ts-ignore
import Respawn from 'respawn'
import { nanoid } from 'nanoid'
import path from 'path'
import semver from 'semver'
import SocketEventsHandler from './Wrapper.js'
import fs from 'fs-extra'
import ejson from 'ejson'
import os from 'os'

// This is a messy way to load a package.json, but createRequire, or path.resolve aren't webpack safe
const moduleBasePkgStr = fs
	.readFileSync(new URL('../../node_modules/@companion-module/base/package.json', import.meta.url))
	.toString()
const moduleBasePkg = JSON.parse(moduleBasePkgStr)

const moduleVersion = semver.parse(moduleBasePkg.version)
if (!moduleVersion)
	throw new Error(`Failed to parse @companion-module/base version as semver: ${moduleBasePkg.version}`)
const additionalVersions = moduleVersion.major === 1 ? '~0.6 ||' : '' // Allow 0.6, as it is compatible with 1.0, but semver made the jump necessary
const validApiRange = new semver.Range(
	`${additionalVersions} ${moduleVersion.major} <= ${moduleVersion.major}.${moduleVersion.minor}` // allow patch versions of the same minor
)

/**
 * A backoff sleep strategy
 * @param {number} i
 * @returns {number} ms to sleep
 */
function sleepStrategy(i) {
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
 * @param {string} id
 * @returns
 */
export function ConnectionDebugLogRoom(id) {
	return `connection-debug:update:${id}`
}

/**
 * @typedef {{
 *   connectionId: string
 *   logger: import('winston').Logger
 *   restartCount: number
 *   isReady: boolean
 *   monitor?: any
 *   handler?: SocketEventsHandler
 *   lifeCycleQueue: PQueue
 *   authToken?: string
 *   crashed?: NodeJS.Timeout
 *   skipApiVersionCheck?: boolean
 * }} ModuleChild
 */

class ModuleHost {
	#logger = LogController.createLogger('Instance/ModuleHost')

	/**
	 * @type {import('../Registry.js').default}
	 */
	#registry

	/**
	 * @type {import('./Status.js').default}
	 */
	#instanceStatus

	/**
	 * Queue for starting connections, to limit how many can be starting concurrently
	 * @type {PQueue}
	 */
	#startQueue

	/**
	 * @type {Map<string, ModuleChild>}
	 */
	#children

	/**
	 * @param {import('../Registry.js').default} registry
	 * @param {import('./Status.js').default} instanceStatus
	 */
	constructor(registry, instanceStatus) {
		this.#registry = registry
		this.#instanceStatus = instanceStatus

		const cpuCount = os.cpus().length // An approximation
		this.#startQueue = new PQueue({ concurrency: Math.max(cpuCount - 1, 1) })

		this.#children = new Map()
	}

	/**
	 * Bind events/initialise a connected child process
	 * @param {?} child
	 * @param {() => void} startupCompleted
	 * @param {(err: Error) => void} startupFailed
	 */
	#listenToModuleSocket(child, startupCompleted, startupFailed) {
		const forceRestart = () => {
			// Force restart the connection, as it failed to initialise and will be broken
			child.restartCount++

			child.monitor.off('exit', forceRestart)
			child.monitor.off('message', initHandler)

			// Report the failure
			startupFailed(new Error('Restart forced'))

			const sleepDuration = sleepStrategy(child.restartCount)
			if (!child.crashed) {
				child.crashed = setTimeout(() => {
					const config = this.#registry.instance.store.db[child.connectionId]
					const moduleInfo = config && this.#registry.instance.modules.getModuleManifest(config.instance_type)

					// Restart after a short sleep
					this.queueRestartConnection(child.connectionId, config, moduleInfo)
				}, sleepDuration)
			}

			// Stop it now
			child.monitor?.stop()
			delete child.handler
		}

		const debugLogRoom = ConnectionDebugLogRoom(child.connectionId)

		/**
		 * @param {Record<string, any>} msg
		 * @returns {void}
		 */
		const initHandler = (msg) => {
			if (msg.direction === 'call' && msg.name === 'register' && msg.callbackId && msg.payload) {
				const { apiVersion, connectionId, verificationToken } = ejson.parse(msg.payload)
				if (!child.skipApiVersionCheck && !validApiRange.test(apiVersion)) {
					this.#logger.debug(`Got register for unsupported api version "${apiVersion}" connectionId: "${connectionId}"`)
					this.#registry.io.emitToRoom(
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

				// Bind the event listeners
				child.handler = new SocketEventsHandler(
					this.#registry,
					this.#instanceStatus,
					child.monitor,
					connectionId,
					apiVersion
				)

				// Register successful
				// child.doWorkTask = registerResult.doWorkTask
				this.#logger.debug(`Registered module client "${connectionId}"`)

				// TODO module-lib - can we get this in a cleaner way?
				const config = this.#registry.instance.store.db[connectionId]
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
				this.#instanceStatus.updateInstanceStatus(connectionId, 'initializing', null)

				child.handler
					.init(config)
					.then(() => {
						child.restartCount = 0

						child.monitor.off('exit', forceRestart)
						child.monitor.off('message', initHandler)

						startupCompleted()

						// mark child as ready to receive
						child.isReady = true

						// Make sure clients are informed about any runtime properties
						this.#registry.instance.commitChanges()

						// Inform action recorder
						this.#registry.controls.actionRecorder.connectionAvailabilityChange(connectionId, true)
					})
					.catch((/** @type {any} */ e) => {
						this.#logger.warn(`Instance "${config.label || child.connectionId}" failed to init: ${e} ${e?.stack}`)
						this.#registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'error', `Failed to init: ${e} ${e?.stack}`)

						forceRestart()
					})
			}
		}
		child.monitor.on('message', initHandler)
		child.monitor.on('exit', forceRestart)
	}

	/**
	 * Get a handle to an active instance
	 * @param {string} connectionId
	 * @param {boolean=} allowInitialising
	 * @returns {any} ??
	 */
	getChild(connectionId, allowInitialising) {
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
	resubscribeAllFeedbacks() {
		for (const child of this.#children.values()) {
			if (child.handler && child.isReady) {
				child.handler.sendAllFeedbackInstances().catch((/** @type {any} */ e) => {
					this.#logger.warn(`sendAllFeedbackInstances failed for "${child.connectionId}": ${e}`)
				})
			}
		}
	}

	/**
	 * Send a list of changed variables to all active instances.
	 * This will trigger feedbacks using variables to be rechecked
	 * @param {Set<string>} all_changed_variables_set
	 */
	onVariablesChanged(all_changed_variables_set) {
		const changedVariableIds = Array.from(all_changed_variables_set)

		for (const child of this.#children.values()) {
			if (child.handler && child.isReady) {
				child.handler.sendVariablesChanged(changedVariableIds).catch((/** @type {any} */ e) => {
					this.#logger.warn(`sendVariablesChanged failed for "${child.connectionId}": ${e}`)
				})
			}
		}
	}

	/**
	 * Stop all running instances
	 */
	async queueStopAllConnections() {
		/** @type {Array<Promise<void>>} */
		const ps = []

		for (const connectionId of this.#children.keys()) {
			ps.push(this.queueStopConnection(connectionId))
		}

		await Promise.all(ps)
	}

	/**
	 * Stop an instance process/thread
	 * @param {string} connectionId
	 */
	async queueStopConnection(connectionId) {
		const child = this.#children.get(connectionId)
		if (child) {
			await child.lifeCycleQueue.add(async () => this.#doStopConnectionInner(connectionId, true))
		}
	}

	/**
	 * Stop an instance running
	 * @access private
	 * @param {string} connectionId
	 * @param {boolean} allowDeleteIfEmpty delete the work-queue if it has no further jobs
	 */
	async #doStopConnectionInner(connectionId, allowDeleteIfEmpty) {
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
				await new Promise((resolve) => monitor.stop(resolve))
			}

			if (allowDeleteIfEmpty && child.lifeCycleQueue.size === 0) {
				// Delete the queue now that it is empty
				this.#children.delete(connectionId)
			}

			// mark connection as disabled
			this.#instanceStatus.updateInstanceStatus(connectionId, null, 'Disabled')
		}
	}

	/**
	 * Update the logger label for a child process
	 * @param {string} connectionId
	 * @param {string} label
	 */
	updateChildLabel(connectionId, label) {
		let child = this.#children.get(connectionId)
		if (child) {
			child.logger = this.#registry.log.createLogger(`Instance/${label}`)
		}
	}

	/**
	 * Start or restart an instance process
	 * @access public
	 * @param {string} connectionId
	 * @param {import('./Controller.js').ConnectionConfig} config
	 * @param {import('./Modules.js').ModuleInfo | undefined} moduleInfo
	 */
	async queueRestartConnection(connectionId, config, moduleInfo) {
		if (!config || !moduleInfo) return

		let child = this.#children.get(connectionId)
		if (!child) {
			// Create a new child entry
			child = {
				connectionId,
				lifeCycleQueue: new PQueue({ concurrency: 1 }),
				logger: this.#registry.log.createLogger(`Instance/${config.label}`),
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
						this.#logger.info(`Starting connection: "${config.label}"(${connectionId})`)

						// stop any existing child process
						await this.#doStopConnectionInner(connectionId, false)

						if (moduleInfo.manifest.runtime.api !== 'nodejs-ipc') {
							this.#logger.error(`Only nodejs-ipc api is supported currently: "${connectionId}"`)
							return
						}

						if (moduleInfo.manifest.runtime.type !== 'node18') {
							this.#logger.error(`Only node18 runtime is supported currently: "${connectionId}"`)
							return
						}

						if (moduleInfo.isPackaged && !validApiRange.test(moduleInfo.manifest.runtime.apiVersion)) {
							this.#logger.error(
								`Module Api version is too new/old: "${connectionId}" ${moduleInfo.manifest.runtime.apiVersion} ${validApiRange}`
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

						const cmd = [
							// Future: vary depending on module version
							// 'node', // For now we can use fork
							inspectPort !== undefined ? `--inspect=${inspectPort}` : undefined,
							jsPath,
						].filter((v) => !!v)
						this.#logger.silly(`Connection "${config.label}" command: ${JSON.stringify(cmd)}`)

						const monitor = Respawn(cmd, {
							name: `Connection "${config.label}"(${connectionId})`,
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
							fork: true, // Future: temporary until we want multiple node/runtime versions
							stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
						})

						const debugLogRoom = ConnectionDebugLogRoom(connectionId)
						this.#registry.io.emitToRoom(
							debugLogRoom,
							debugLogRoom,
							'system',
							`** Starting Connection from "${path.join(moduleInfo.basePath, jsPath)}" **`
						)

						monitor.on('start', () => {
							child.isReady = false
							this.#logger.debug(`Connection "${config.label}" started`)
							this.#registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection started **')
						})
						monitor.on('stop', () => {
							child.isReady = false
							this.#instanceStatus.updateInstanceStatus(
								connectionId,
								child.crashed ? 'crashed' : null,
								child.crashed ? '' : 'Stopped'
							)
							this.#logger.debug(`Connection "${config.label}" stopped`)
							this.#registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection stopped **')

							this.#registry.controls.actionRecorder.connectionAvailabilityChange(connectionId, false)
						})
						monitor.on('crash', () => {
							child.isReady = false
							this.#instanceStatus.updateInstanceStatus(connectionId, null, 'Crashed')
							this.#logger.debug(`Connection "${config.label}" crashed`)
							this.#registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection crashed **')
						})
						monitor.on('stdout', (/** @type {Buffer} */ data) => {
							if (!moduleInfo.isPackaged) {
								// Only show stdout for modules which are being developed
								child.logger.verbose(`stdout: ${data.toString()}`)
							}

							if (this.#registry.io.countRoomMembers(debugLogRoom) > 0) {
								this.#registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'console', data.toString())
							}
						})
						monitor.on('stderr', (/** @type {Buffer} */ data) => {
							child.logger.verbose(`stderr: ${data.toString()}`)
							if (this.#registry.io.countRoomMembers(debugLogRoom) > 0) {
								this.#registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'error', data.toString())
							}
						})

						child.monitor = monitor

						const initialisedPromise = new Promise((resolve, reject) => {
							// @ts-ignore
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

export default ModuleHost
