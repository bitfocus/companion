/* eslint-disable n/no-process-exit */
import { IpcWrapper } from '../IpcWrapper.js'
import type { SurfaceModuleToHostEvents, HostToSurfaceModuleEvents } from '../IpcTypes.js'
import {
	type SurfaceModuleManifest,
	registerLoggingSink,
	createModuleLogger,
	PluginWrapper,
} from '@companion-surface/host'
import fs from 'fs/promises'
import { HostContext } from './HostContext.js'
import { translateOutboundConfigFields } from './ConfigFields.js'

const moduleEntrypoint = process.env.MODULE_ENTRYPOINT
if (!moduleEntrypoint) throw new Error('Module initialise is missing MODULE_ENTRYPOINT')

const manifestPath = process.env.MODULE_MANIFEST
if (!manifestPath) throw new Error('Module initialise is missing MODULE_MANIFEST')

// check manifest api field against apiVersion
const manifestBlob = await fs.readFile(manifestPath, 'utf-8')
const manifestJson: Partial<SurfaceModuleManifest> = JSON.parse(manifestBlob)

if (!manifestJson.runtime?.apiVersion) throw new Error(`Module manifest 'apiVersion' missing`)

if (!process.send) throw new Error('Module is not being run with ipc')

console.log(`Starting up surface module: ${manifestJson.id}`)

const verificationToken = process.env.VERIFICATION_TOKEN
if (typeof verificationToken !== 'string' || !verificationToken)
	throw new Error('Module initialise is missing VERIFICATION_TOKEN')

const logger = createModuleLogger('Entrypoint')

let plugin: PluginWrapper | null = null
let pluginInitialized = false

// Setup the ipc wrapper, the plugin may not yet exist, but this is better so that we can send log lines out
const ipcWrapper = new IpcWrapper<SurfaceModuleToHostEvents, HostToSurfaceModuleEvents>(
	{
		openHidDevice: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const info = await plugin.openHidDevice(msg.device)

			// Make sure the surface is ready
			if (info) {
				// TODO - verify this is the correct place for this
				await plugin.readySurface(info.surfaceId)
			}

			return { info }
		},
		checkHidDevice: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const info = await plugin.checkHidDevice(msg.device)
			return { info }
		},
		scanDevices: async () => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const devices = await plugin.scanForDevices()
			return { devices }
		},
		openScannedDevice: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const info = await plugin.openScannedDevice(msg.device)
			return { info }
		},
		destroy: async () => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			pluginInitialized = false

			await plugin.destroy()

			// Ensure the process exits after responding to the message
			setTimeout(() => process.exit(0), 100)
		},

		setBrightness: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.setBrightness(msg.surfaceId, msg.brightness)
		},
		drawControls: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.draw(
				msg.surfaceId,
				msg.drawProps.map((d) => ({
					// Convert base64 back into a buffer. TODO: could this be done lazily/by the plugin on demand?
					...d,
					image: d.image ? Buffer.from(d.image, 'base64') : undefined,
				}))
			)
		},
		blankSurface: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.blankSurface(msg.surfaceId)
		},
		setLocked: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.showLockedStatus(msg.surfaceId, msg.locked, msg.characterCount)
		},
		setOutputVariable: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.onVariableValue(msg.surfaceId, msg.name, msg.value)
		},

		setupRemoteConnections: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.setupRemoteConnections(msg.connectionInfos)
		},
		stopRemoteConnections: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.stopRemoteConnections(msg.connectionIds)
		},
	},
	(msg) => {
		process.send!(msg)
	},
	5000
)
process.on('message', (msg) => ipcWrapper.receivedMessage(msg as any))

registerLoggingSink((source, level, message) => {
	if (!process.send) {
		console.log(`[${level.toUpperCase()}]${source ? ` [${source}]` : ''} ${message}`)
	} else {
		ipcWrapper.sendWithNoCb('log-message', {
			time: Date.now(),
			source,
			level,
			message,
		})
	}
})

// Now load the plugin
plugin = new PluginWrapper(
	new HostContext(ipcWrapper),
	// Future: Once webpacked, the dynamic import() doesn't work, so fallback to require()
	typeof __non_webpack_require__ === 'function'
		? __non_webpack_require__(moduleEntrypoint)
		: (await import(moduleEntrypoint)).default
)

const pluginFeatures = plugin.getPluginFeatures()
ipcWrapper
	.sendWithCb('register', {
		verificationToken,

		// Report features
		supportsDetection: pluginFeatures.supportsDetection,
		supportsHid: pluginFeatures.supportsHid,
		supportsScan: pluginFeatures.supportsScan,
		supportsOutbound: pluginFeatures.supportsOutbound
			? {
					configFields: translateOutboundConfigFields(pluginFeatures.supportsOutbound.configFields),
				}
			: null,
	})
	.then(async () => {
		logger.info(`Module-host accepted registration`)

		await plugin.init()

		pluginInitialized = true

		logger.info('Module initialized successfully')

		// Report the plugin is now ready for use
		ipcWrapper.sendWithNoCb('ready', {})
	})
	.catch((err) => {
		logger.error(`Module registration failed: ${err}`)

		// Kill the process
		process.exit(11)
	})
