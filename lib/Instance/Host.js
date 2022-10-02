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
const validApiRange = new semver.Range(`${moduleVersion.major} <= ${moduleBasePkg.version}`)

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

class ModuleHost {
	constructor(registry, instanceStatus) {
		this.logger = LogController.createLogger('Instance/ModuleHost')
		this.registry = registry
		this.instanceStatus = instanceStatus

		this.children = new Map()
	}

	/**
	 * Initialise the module host. Must only be run once
	 * @access public
	 */
	async init() {
		// this.socketServer.on('connection', (socket) => {
		// 	this.logger.debug('A module connected')
		// 	this.#listenToModuleSocket(socket)
		// })
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
				if (!validApiRange.test(apiVersion)) {
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
				console.log('send success')
				child.monitor.child.send({
					direction: 'response',
					callbackId: msg.callbackId,
					success: true,
					payload: ejson.stringify({}),
				})

				// TODO module-lib - start pings

				// Init module

				child.handler
					.init(config)
					.then(() => {
						child.restartCount = 0

						// Make sure clients are informed about any runtime properties
						this.registry.instance.commitChanges()

						// Inform action recorder
						this.registry.controls.actionRecorder.instanceStatusChange(connectionId, true)
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
	getChild(connectionId) {
		const child = this.children.get(connectionId)
		if (child) {
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
			if (child.handler) {
				child.handler.sendAllFeedbackInstances().catch((e) => {
					this.logger.warn(`sendAllFeedbackInstances failed for "${child.connectionId}": ${e}`)
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

				const child = this.children.get(connectionId)
				if (!child) {
					this.logger.verbose(`Lost tracking object for connection: "${connectionId}"`)
					return
				}

				// stop any existing child process
				await this.#doStopConnectionInner(connectionId, false)

				child.authToken = nanoid()
				const cmd = [
					// Future: vary depending on module version
					// 'node', // For now we can use fork
					path.join(moduleInfo.basePath, 'companion', moduleInfo.manifest.runtime.entrypoint),
				]
				this.logger.silly(`Connection "${config.label}" command: ${JSON.stringify(cmd)}`)

				const monitor = Respawn(cmd, {
					name: `Connection "${config.label}"(${connectionId})`,
					env: {
						CONNECTION_ID: connectionId,
						VERIFICATION_TOKEN: child.authToken,
						MODULE_MANIFEST: path.join(moduleInfo.basePath, 'companion/manifest.json'),

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

				// TODO module-lib - better event listeners
				monitor.on('start', () => {
					this.logger.debug(`Connection "${config.label}" started`)
				})
				monitor.on('stop', () => {
					this.instanceStatus.updateInstanceStatus(
						connectionId,
						child.crashed ? 'crashed' : null,
						child.crashed ? 'Crashed' : 'Stopped'
					)
					this.logger.debug(`Connection "${config.label}" stopped`)

					this.registry.controls.actionRecorder.instanceStatusChange(connectionId, false)
				})
				monitor.on('crash', () => {
					this.instanceStatus.updateInstanceStatus(connectionId, null, 'Crashed')
					this.logger.debug(`Connection "${config.label}" crashed`)
				})
				monitor.on('stdout', (data) => {
					child.logger.verbose(`stdout: ${data.toString()}`)
				})
				monitor.on('stderr', (data) => {
					child.logger.verbose(`stderr: ${data.toString()}`)
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
