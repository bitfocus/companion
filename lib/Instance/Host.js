import LogController from '../Log/Controller.js'
import PQueue from 'p-queue'
import Respawn from 'respawn'
import { nanoid } from 'nanoid'
import path from 'path'
import semver from 'semver'
import SocketEventsHandler from './Wrapper.js'
import fs from 'fs-extra'
import ejson from 'ejson'

// This is a messy way to load a package.json, but createRequire, or path.resolve aren't webpack safe
const moduleBasePkgStr = fs
	.readFileSync(new URL('../../node_modules/@companion-module/base/package.json', import.meta.url))
	.toString()
const moduleBasePkg = JSON.parse(moduleBasePkgStr)

const moduleVersion = semver.parse(moduleBasePkg.version)
const additionalVersions = moduleVersion.major === 1 ? '~0.6 ||' : '' // Allow 0.6, as it is compatible with 1.0, but semver made the jump necessary
const validApiRange = new semver.Range(
	`${additionalVersions} ${moduleVersion.major} <= ${moduleVersion.major}.${moduleVersion.minor}` // allow patch versions of the same minor
)

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

export function ConnectionDebugLogRoom(id) {
	return `connection-debug:update:${id}`
}

class ModuleHost {
	constructor(registry, instanceStatus) {
		this.logger = LogController.createLogger('Instance/ModuleHost')
		this.registry = registry
		this.instanceStatus = instanceStatus

		this.children = new Map()
	}

	/**
	 * Bind events/initialise a connected child process
	 * @param {?} child
	 */
	#listenToModuleSocket(child) {
		const forceRestart = () => {
			// Force restart the connetion, as it failed to initialise and will be broken
			child.restartCount++

			const sleepDuration = sleepStrategy(child.restartCount)
			if (!child.crashed) {
				child.crashed = setTimeout(() => {
					const config = this.registry.instance.store.db[child.connectionId]
					const moduleInfo = this.registry.instance.known_modules[config?.instance_type]

					// Restart after a short sleep
					this.queueRestartConnection(child.connectionId, config, moduleInfo)
				}, sleepDuration)
			}

			// Stop it now
			child.monitor?.stop()
			delete child.handler
		}

		const initHandler = (msg) => {
			if (msg.direction === 'call' && msg.name === 'register' && msg.callbackId && msg.payload) {
				const { apiVersion, connectionId, verificationToken } = ejson.parse(msg.payload)
				if (!child.skipApiVersionCheck && !validApiRange.test(apiVersion)) {
					this.logger.debug(`Got register for unsupported api version "${apiVersion}" connectionId: "${connectionId}"`)

					forceRestart()
					return
				}

				if (child.authToken !== verificationToken) {
					this.logger.debug(`Got register with bad auth token for connectionId: "${connectionId}"`)
					forceRestart()
					return
				}

				if (child.crashed) {
					// Clear existing restart timer
					clearTimeout(child.crashed)
					delete child.crashed
				}

				// Bind the event listeners
				child.handler = new SocketEventsHandler(this.registry, this.instanceStatus, child.monitor, connectionId)

				// Register successful
				// child.doWorkTask = registerResult.doWorkTask
				this.logger.debug(`Registered module client "${connectionId}"`)

				// TODO module-lib - can we get this in a cleaner way?
				const config = this.registry.instance.store.db[connectionId]
				if (!config) {
					this.logger.verbose(`Missing config for instance "${connectionId}"`)
					forceRestart()
					return
				}
				// const moduleInfo = this.registry.instance.known_modules[config.instance_type]
				// if (!moduleInfo) {
				// 	this.logger.verbose(`Missing manifest for instance "${connectionId}"`)
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
				this.registry.instance.status.updateInstanceStatus(connectionId, 'initializing')

				child.handler
					.init(config)
					.then(() => {
						child.restartCount = 0

						// mark child as ready to receive
						child.isReady = true

						// Make sure clients are informed about any runtime properties
						this.registry.instance.commitChanges()

						// Inform action recorder
						this.registry.controls.actionRecorder.instanceAvailabilityChange(connectionId, true)
					})
					.catch((e) => {
						this.logger.warn(`Instance "${config.label || child.connectionId}" failed to init: ${e} ${e?.stack}`)

						forceRestart()
					})
			}
		}
		child.monitor.on('message', initHandler)
	}

	/**
	 * Get a handle to an active instance
	 * @param {string} connectionId
	 * @returns {any} ??
	 */
	getChild(connectionId, allowInitialising) {
		const child = this.children.get(connectionId)
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
		for (const child of this.children.values()) {
			if (child.handler && child.isReady) {
				child.handler.sendAllFeedbackInstances().catch((e) => {
					this.logger.warn(`sendAllFeedbackInstances failed for "${child.connectionId}": ${e}`)
				})
			}
		}
	}

	/**
	 * Send a list of changed variables to all active instances.
	 * This will trigger feedbacks using variables to be rechecked
	 */
	onVariablesChanged(changed_variables, removed_variables) {
		const changedVariableIds = [...Object.keys(changed_variables), ...removed_variables]

		for (const child of this.children.values()) {
			if (child.handler && child.isReady) {
				child.handler.sendVariablesChanged(changedVariableIds).catch((e) => {
					this.logger.warn(`sendVariablesChanged failed for "${child.connectionId}": ${e}`)
				})
			}
		}
	}

	/**
	 * Stop all running instances
	 */
	async queueStopAllConnections() {
		const ps = []

		for (const connectionId of this.children.keys()) {
			ps.push(this.queueStopConnection(connectionId))
		}

		await Promise.all(ps)
	}

	/**
	 * Stop an instance process/thread
	 * @param {string} connectionId
	 */
	async queueStopConnection(connectionId) {
		const child = this.children.get(connectionId)
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
		const child = this.children.get(connectionId)
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
				this.children.delete(connectionId)
			}
		}
	}

	/**
	 * Update the logger label for a child process
	 * @param {string} connectionId
	 * @param {string} label
	 */
	async updateChildLabel(connectionId, label) {
		let child = this.children.get(connectionId)
		if (child) {
			child.logger = this.registry.log.createLogger(`Instance/${label}`)
		}
	}

	/**
	 * Start or restart an instance process
	 * @access public
	 * @param {string} connectionId
	 * @param {object} config
	 * @param {object} moduleInfo
	 */
	async queueRestartConnection(connectionId, config, moduleInfo) {
		if (!config || !moduleInfo) return

		let child = this.children.get(connectionId)
		if (!child) {
			// Create a new child entry
			child = {
				connectionId,
				lifeCycleQueue: new PQueue({ concurrency: 1 }),
				logger: this.registry.log.createLogger(`Instance/${config.label}`),
				restartCount: 0,
				isReady: false,
			}
			this.children.set(connectionId, child)
		}

		await child.lifeCycleQueue.add(async () => {
			if (config && config.enabled !== false) {
				this.logger.info(`Starting connection: "${config.label}"(${connectionId})`)

				if (moduleInfo.manifest.runtime.api !== 'nodejs-ipc') {
					this.logger.error(`Only nodejs-ipc api is supported currently: "${connectionId}"`)
					return
				}

				if (moduleInfo.manifest.runtime.type !== 'node18') {
					this.logger.error(`Only node18 runtime is supported currently: "${connectionId}"`)
					return
				}

				if (moduleInfo.isPackaged && !validApiRange.test(moduleInfo.manifest.runtime.apiVersion)) {
					this.logger.error(
						`Module Api version is too new/old: "${connectionId}" ${moduleInfo.manifest.runtime.apiVersion} ${validApiRange}`
					)
					return
				}

				const child = this.children.get(connectionId)
				if (!child) {
					this.logger.verbose(`Lost tracking object for connection: "${connectionId}"`)
					return
				}

				// stop any existing child process
				await this.#doStopConnectionInner(connectionId, false)

				child.authToken = nanoid()
				child.skipApiVersionCheck = !moduleInfo.isPackaged

				const cmd = [
					// Future: vary depending on module version
					// 'node', // For now we can use fork
					path.join('companion', moduleInfo.manifest.runtime.entrypoint),
				]
				this.logger.silly(`Connection "${config.label}" command: ${JSON.stringify(cmd)}`)

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

				monitor.on('start', () => {
					child.isReady = false
					this.logger.debug(`Connection "${config.label}" started`)
					this.registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection started **')
				})
				monitor.on('stop', () => {
					child.isReady = false
					this.instanceStatus.updateInstanceStatus(
						connectionId,
						child.crashed ? 'crashed' : null,
						child.crashed ? '' : 'Stopped'
					)
					this.logger.debug(`Connection "${config.label}" stopped`)
					this.registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection stopped **')

					this.registry.controls.actionRecorder.instanceAvailabilityChange(connectionId, false)
				})
				monitor.on('crash', () => {
					child.isReady = false
					this.instanceStatus.updateInstanceStatus(connectionId, null, 'Crashed')
					this.logger.debug(`Connection "${config.label}" crashed`)
					this.registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'system', '** Connection crashed **')
				})
				monitor.on('stdout', (data) => {
					if (!moduleInfo.isPackaged) {
						// Only show stdout for modules which are being developed
						child.logger.verbose(`stdout: ${data.toString()}`)
					}
					this.registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'console', data.toString())
				})
				monitor.on('stderr', (data) => {
					child.logger.verbose(`stderr: ${data.toString()}`)
					this.registry.io.emitToRoom(debugLogRoom, debugLogRoom, 'error', data.toString())
				})

				child.monitor = monitor

				this.#listenToModuleSocket(child)

				// Start the child
				child.monitor.start()

				// TODO module-lib - timeout for first contact
			} else {
				this.logger.debug(`Attempting to start missing connection: "${connectionId}"`)
				await this.#doStopConnectionInner(connectionId, true)
			}
		})
	}
}

export default ModuleHost
