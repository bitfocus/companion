/* eslint-disable n/no-process-exit */
import { IpcWrapper } from '../../Common/IpcWrapper.js'
import type { SurfaceModuleToHostEvents, HostToSurfaceModuleEvents, CheckDeviceInfo } from '../IpcTypes.js'
import {
	type SurfaceModuleManifest,
	registerLoggingSink,
	createModuleLogger,
	PluginWrapper,
} from '@companion-surface/host'
import fs from 'fs/promises'
import { HostContext } from './HostContext.js'
import { translateSurfaceConfigFields } from './ConfigFields.js'
import { convertOpenDeviceResult } from './Util.js'

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
		init: async () => {
			if (pluginInitialized) throw new Error('Already initialized')
			if (!plugin) throw new Error('Plugin not loaded')

			await plugin.init()

			pluginInitialized = true

			logger.info('Module initialized successfully')
		},
		destroy: async () => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			pluginInitialized = false

			await plugin.destroy()

			// Ensure the process exits after responding to the message
			setTimeout(() => process.exit(0), 100)
		},

		openHidDevice: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const info = await plugin.openHidDevice(msg.device, msg.resolvedSurfaceId)
			if (!info) return { info: null }

			// Return with the resolved surface ID
			return {
				info: convertOpenDeviceResult({
					...info,
					surfaceId: msg.resolvedSurfaceId,
				}),
			}
		},
		checkHidDevices: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const devices: CheckDeviceInfo[] = []
			for (const device of msg.devices) {
				const result = await plugin.checkHidDevice(device)
				if (result) {
					devices.push({
						devicePath: device.path,
						surfaceId: result.surfaceId,
						surfaceIdIsNotUnique: result.surfaceIdIsNotUnique,
						description: result.description,
					})
				}
			}
			return { devices }
		},
		scanDevices: async () => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const devices = await plugin.scanForDevices()
			return { devices }
		},
		openScannedDevice: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const info = await plugin.openScannedDevice(msg.device, msg.resolvedSurfaceId)
			if (!info) return { info: null }

			// Return with the resolved surface ID
			return {
				info: convertOpenDeviceResult({
					...info,
					surfaceId: msg.resolvedSurfaceId,
				}),
			}
		},
		closeSurface: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.closeDevice(msg.surfaceId)
		},
		readySurface: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.readySurface(msg.surfaceId, msg.initialConfig)
		},
		updateConfig: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			await plugin.updateConfig(msg.surfaceId, msg.newConfig)
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

const ensureFileUrl = (url: string) => {
	if (process.platform === 'win32' && !url.startsWith('file://')) {
		// Windows is picky about import paths, this is a crude hack to 'fix' it
		return `file://${url}`
	} else {
		return url
	}
}

// Now load the plugin
plugin = new PluginWrapper(
	new HostContext(ipcWrapper),
	// Future: Once webpacked, the dynamic import() doesn't work, so fallback to require()
	typeof __non_webpack_require__ === 'function'
		? __non_webpack_require__(moduleEntrypoint)
		: (await import(ensureFileUrl(moduleEntrypoint))).default
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
					configFields: translateSurfaceConfigFields(pluginFeatures.supportsOutbound.configFields),
					configMatchesExpression: pluginFeatures.supportsOutbound.configMatchesExpression ?? null,
				}
			: null,
	})
	.then(async () => {
		logger.info(`Module-host accepted registration`)
	})
	.catch((err) => {
		logger.error(`Module registration failed: ${err}`)

		// Kill the process
		process.exit(11)
	})
