import * as SocketIOClient from 'socket.io-client'
import PTimeout from 'p-timeout'
import { HostApiSocketIo, HostToModuleEventsInit, ModuleToHostEventsInit } from './host-api/versions.js'
import { InstanceBaseShared } from './instance-base.js'
import fs from 'fs/promises'
import { ModuleManifest } from './manifest.js'
import { readPackage, NormalizedPackageJson } from 'read-pkg'

let hasEntrypoint = false

export type InstanceConstructor = new (internal: unknown, id: string) => InstanceBaseShared<any>

async function runEntrypointInner(factory: InstanceConstructor, libPkgJson: NormalizedPackageJson): Promise<void> {
	// Ensure only called once per module
	if (hasEntrypoint) throw new Error(`runEntrypoint can only be called once`)
	hasEntrypoint = true

	const manifestPath = process.env.MODULE_MANIFEST
	if (!manifestPath) throw new Error('Module initialise is missing MODULE_MANIFEST')

	// check manifest api field against apiVersion
	const manifestBlob = await fs.readFile(manifestPath)
	const manifestJson: Partial<ModuleManifest> = JSON.parse(manifestBlob.toString())

	if (manifestJson.runtime?.api !== HostApiSocketIo) throw new Error(`Module manifest 'api' mismatch`)

	console.log(`Starting up module class: ${factory.name}`)

	const connectionId = process.env.CONNECTION_ID
	if (typeof connectionId !== 'string' || !connectionId) throw new Error('Module initialise is missing CONNECTION_ID')

	const socketIoUrl = process.env.SOCKETIO_URL
	if (typeof socketIoUrl !== 'string' || !socketIoUrl) throw new Error('Module initialise is missing SOCKETIO_URL')

	const socketIoToken = process.env.SOCKETIO_TOKEN
	if (typeof socketIoToken !== 'string' || !socketIoToken)
		throw new Error('Module initialise is missing SOCKETIO_TOKEN')

	let module: InstanceBaseShared<any> | undefined

	const socket: SocketIOClient.Socket<HostToModuleEventsInit, ModuleToHostEventsInit> = SocketIOClient.io(socketIoUrl, {
		reconnection: false,
		timeout: 5000,
		transports: ['websocket'],
	})
	socket.on('connect', () => {
		console.log(`Connected to module-host: ${socket.id}`)

		socket.emit('register', libPkgJson.version, connectionId, socketIoToken, () => {
			console.log(`Module-host accepted registration`)

			module = new factory(socket, connectionId)
		})
	})
	socket.on('connect_error', (e: any) => {
		console.log(`connection failed to module-host: ${socket.id}`, e.toString())

		process.exit(12)
	})
	socket.on('disconnect', async () => {
		console.log(`Disconnected from module-host: ${socket.id}`)

		if (module) {
			// Try and de-init the module before killing it
			try {
				const p = module.destroy()
				if (p) await PTimeout(p, 5000)
			} catch (e) {
				// Ignore
			}
		}

		// Kill the process
		process.exit(11)
	})
}

export function runEntrypoint(factory: InstanceConstructor): void {
	Promise.resolve().then(async () => {
		try {
			const pkgJson = await readPackage({ cwd: new URL('..', import.meta.url) })
			if (!pkgJson || pkgJson.name !== '@companion-module/base')
				throw new Error('Failed to find the package.json for @companion-module/base')

			const modulePath = process.env.MODULE_FILE
			if (!modulePath) throw new Error('Module initialise is missing MODULE_FILE')

			await runEntrypointInner(factory, pkgJson)
		} catch (e: any) {
			console.error(`Failed to startup module:`)
			console.error(e.stack || e.message)
			process.exit(1)
		}
	})
}
