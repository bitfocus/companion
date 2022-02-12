const debug = require('debug')
const getPort = require('get-port')
const SocketIO = require('socket.io')
const PQueue = require('p-queue').default
const Respawn = require('respawn')
const shortid = require('shortid')
const path = require('path')
const moduleBasePkg = require('../../module-base/package.json')
const semver = require('semver')
const SocketEventsHandler = require('./Wrapper')

const moduleVersion = semver.parse(moduleBasePkg.version)
const validApiRange = new semver.Range(`${moduleVersion.major} <= ${moduleBasePkg.version}`)

class ModuleHost {
	constructor(registry, instanceStatus) {
		this.debug = debug('lib/Instance/ModuleHost')
		this.registry = registry
		this.instanceStatus = instanceStatus

		this.children = new Map()
	}

	async start() {
		this.socketPort = await getPort()
		this.socketServer = new SocketIO.Server({
			transports: ['websocket'],
			allowEIO3: true,
			cors: {
				origin: `http://localhost:${this.socketPort}`,
				methods: ['GET', 'POST'],
			},
		})
		this.socketServer.listen(this.socketPort)
		this.debug(`listening on port: ${this.socketPort}`)

		this.socketServer.on('connection', (socket) => {
			this.debug('A module connected')
			this._listenToModuleSocket(socket)
		})
	}

	getChild(connectionId) {
		const child = this.children.get(connectionId)
		if (child) {
			return child.handler
		} else {
			return undefined
		}
	}

	resubscribeAllFeedbacks() {
		for (const child of this.children.values()) {
			if (child.handler) {
				child.handler.sendAllFeedbackInstances().catch((e) => {
					// TODO -
				})
			}
		}
	}

	async queueStopAll() {
		const ps = []

		for (const connectionId of this.children.keys()) {
			ps.push(this.queueStopConnection(connectionId))
		}

		await Promise.all(ps)
	}

	async queueStopConnection(connectionId) {
		const child = this.children.get(connectionId)
		if (child) {
			await child.lifeCycleQueue.add(async () => this._doStopConnectionInner(connectionId, true))
		}
	}

	async _doStopConnectionInner(connectionId, allowDeleteIfEmpty) {
		const child = this.children.get(connectionId)
		if (child) {
			// Ensure a new child cant register
			delete child.authToken

			if (child.handler) {
				// Perform cleanup of the module and event listeners
				try {
					await child.handler.destroy()
				} catch (e) {
					console.error(`Destroy failed: ${e}`)
				}
			}

			if (child.socket) {
				// Stop the child connection
				child.socket.disconnect(true)
				delete child.socket
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

	_listenToModuleSocket(socket) {
		socket.once('register', (apiVersion, connectionId, token, cb) => {
			if (!validApiRange.test(apiVersion)) {
				// if (!isSupportedApiVersion(apiVersion)) {
				this.debug(`Got register for unsupported api version "${apiVersion}" connectionId: "${connectionId}"`)
				socket.disconnect(true)
				return
			}

			const child = this.children.get(connectionId)
			if (!child) {
				this.debug(`Got register for bad connectionId: "${connectionId}"`)
				socket.disconnect(true)
				return
			}

			if (child.socket) {
				this.debug(`Got register for already registered connectionId: "${connectionId}"`)
				socket.disconnect(true)
				return
			}

			if (child.authToken !== token) {
				this.debug(`Got register with bad auth token for connectionId: "${connectionId}"`)
				socket.disconnect(true)
				return
			}

			socket.on('disconnect', () => {
				const child2 = this.children.get(connectionId)
				if (child2 && child2.socket === socket) {
					// If this socket is the one for a connection, then cleanup on close
					delete child2.socket
				}
			})

			// Bind the event listeners
			child.handler = new SocketEventsHandler(this.registry, this.instanceStatus, socket, connectionId)

			// Register successful
			child.socket = socket
			// child.doWorkTask = registerResult.doWorkTask
			this.debug(`Registered module client "${connectionId}"`)

			// report success
			cb()

			// TODO - start pings

			// TODO - can we get this in a cleaner way?
			const config = this.registry.instance.store.db[connectionId]

			// Init module
			child.handler.init(config).catch((e) => {
				// TODO - log error?

				console.log('Init error', e, e?.stack)

				// Force restart the connetion, as it failed to initialise and will be broken
				this.queueRestartConnection(connectionId)
			})
		})
	}

	async queueRestartConnection(connectionId, config, moduleInfo) {
		if (!config || !moduleInfo) return

		let child = this.children.get(connectionId)
		if (!child) {
			// Create a new child entry
			child = { lifeCycleQueue: new PQueue({ concurrency: 1 }) }
			this.children.set(connectionId, child)
		}

		await child.lifeCycleQueue.add(async () => {
			if (config && config.enabled !== false) {
				this.debug(`Starting connection: "${config.label}"(${connectionId})`)

				// TODO - look at the runtime and api fields to figure out how to handle this

				const child = this.children.get(connectionId)
				if (!child) {
					this.debug(`Lost tracking object for connection : "${connectionId}"`)
					return
				}

				// stop any existing child process
				await this._doStopConnectionInner(connectionId, false)

				child.authToken = shortid()
				const cmd = [
					'node',
					// TODO - vary depending on module version
					path.join(moduleInfo.basePath, 'node_modules/@companion-module/base/dist/entrypoint.js'),
				]
				this.debug(`Connection "${config.label}" command: ${JSON.stringify(cmd)}`)

				const monitor = Respawn(cmd, {
					name: `Connection "${config.label}"(${connectionId})`,
					env: {
						CONNECTION_ID: connectionId,
						SOCKETIO_URL: `ws://localhost:${this.socketPort}`,
						SOCKETIO_TOKEN: child.authToken,
						MODULE_FILE: path.join(moduleInfo.basePath, moduleInfo.manifest.runtime.entrypoint),
						MODULE_MANIFEST: path.join(moduleInfo.basePath, 'companion/manifest.json'),
					},
					maxRestarts: -1,
					kill: 5000,
					cwd: moduleInfo.basePath,
				})

				// TODO - better event listeners
				monitor.on('start', () => {
					this.debug(`Connection "${config.label}" started`)
				})
				monitor.on('stop', () => {
					this.debug(`Connection "${config.label}" stopped`)
				})
				monitor.on('crash', () => {
					this.debug(`Connection "${config.label}" crashed`)
				})
				monitor.on('stdout', (data) => {
					this.debug(`Connection "${config.label}" stdout: ${data.toString()}`)
				})
				monitor.on('stderr', (data) => {
					this.debug(`Connection "${config.label}" stderr: ${data.toString()}`)
				})

				child.monitor = monitor

				// Start the child
				child.monitor.start()

				// TODO - timeout for first contact
			} else {
				this.debug(`Attempting to start missing connection: "${connectionId}"`)
				await this._doStopConnectionInner(connectionId, true)
			}
		})
	}
}

module.exports = ModuleHost
