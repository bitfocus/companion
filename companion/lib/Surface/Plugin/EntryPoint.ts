/* eslint-disable n/no-process-exit */
import { IpcWrapper } from '@companion-module/base/dist/host-api/ipc-wrapper.js'
import type { SurfaceModuleToHostEvents, HostToSurfaceModuleEvents } from './IpcTypes.js'
import { SurfaceModuleManifest } from '@companion-surface/base'
import fs from 'fs/promises'
import { PluginWrapper } from '@companion-surface/base/host'
import { HostContext } from './HostContext.js'

const moduleEntrypoint = process.env.MODULE_ENTRYPOINT
if (!moduleEntrypoint) throw new Error('Module initialise is missing MODULE_ENTRYPOINT')

const manifestPath = process.env.MODULE_MANIFEST
if (!manifestPath) throw new Error('Module initialise is missing MODULE_MANIFEST')

// check manifest api field against apiVersion
const manifestBlob = await fs.readFile(manifestPath, 'utf-8')
const manifestJson: Partial<SurfaceModuleManifest> = JSON.parse(manifestBlob)

if (!manifestJson.runtime?.apiVersion) throw new Error(`Module manifest 'apiVersion' missing`)

// TODO - check apiversion is supported
// if (!isModuleApiVersionCompatible(manifestJson.apiVersion, SUPPORTED_API_VERSIONS)) {
// 	throw new Error(
// 		`Module manifest 'apiVersion' ${manifestJson.apiVersion} is not supported by this version of Companion (supported: ${SUPPORTED_API_VERSIONS.join(
// 			', '
// 		)})`
// 	)
// }

if (!process.send) throw new Error('Module is not being run with ipc')

console.log(`Starting up surface module: ${manifestJson.id}`)

const verificationToken = process.env.VERIFICATION_TOKEN
if (typeof verificationToken !== 'string' || !verificationToken)
	throw new Error('Module initialise is missing VERIFICATION_TOKEN')

let plugin: PluginWrapper | null = null
let pluginInitialized = false

// Setup the ipc wrapper, the plugin may not yet exist, but this is better so that we can send log lines out
const ipcWrapper = new IpcWrapper<SurfaceModuleToHostEvents, HostToSurfaceModuleEvents>(
	{
		openHidDevice: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const info = await plugin.openHidDevice(msg.device)
			return { info }
		},
		checkHidDevice: async (msg) => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			const info = await plugin.checkHidDevice(msg.device)
			return { info }
		},
		destroy: async () => {
			if (!plugin || !pluginInitialized) throw new Error('Not initialized')

			pluginInitialized = false

			await plugin.destroy()

			// Ensure the process exits asap
			process.exit(0)
		},
	},
	(msg) => {
		process.send!(msg)
	},
	5000
)
process.on('message', (msg) => ipcWrapper.receivedMessage(msg as any))

// Now load the plugin
plugin = new PluginWrapper(new HostContext(ipcWrapper), await import(moduleEntrypoint))

const pluginFeatures = plugin.getPluginFeatures()
ipcWrapper
	.sendWithCb('register', {
		verificationToken,

		// Report features
		supportsDetection: pluginFeatures.supportsDetection,
		supportsHid: pluginFeatures.supportsHid,
		supportsScan: pluginFeatures.supportsScan,
	})
	.then(async () => {
		console.log(`Module-host accepted registration`)

		await plugin.init()

		pluginInitialized = true

		// Report the plugin is now ready for use
		ipcWrapper.sendWithNoCb('ready', {})
	})
	.catch((err) => {
		console.error('Module registration failed', err)

		// Kill the process
		process.exit(11)
	})
