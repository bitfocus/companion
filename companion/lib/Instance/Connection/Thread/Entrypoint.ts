/* eslint-disable n/no-process-exit */
import fs from 'node:fs/promises'
import type { ModuleManifest } from '@companion-module/base/manifest'
import { createModuleLogger, InstanceWrapper, registerLoggingSink } from '@companion-module/host'
import { IpcWrapper } from '../../Common/IpcWrapper.js'
import { importModuleFromPath } from '../../Common/ThreadUtil.js'
import type {
	ExecuteActionResponseMessage,
	GetConfigFieldsResponseMessage,
	HandleHttpRequestResponseMessage,
	HostToModuleEventsNew,
	InitResponseMessage,
	LearnActionResponseMessage,
	LearnFeedbackResponseMessage,
	ModuleToHostEventsNew,
	UpdateActionInstancesMessage,
	UpdateFeedbackInstancesMessage,
	UpgradeActionsResponse,
	UpgradeFeedbacksResponse,
} from '../IpcTypesNew.js'
import { translateConnectionConfigFields } from './ConfigFields.js'
import { HostContext } from './HostContext.js'

const moduleEntrypoint = process.env.MODULE_ENTRYPOINT
if (!moduleEntrypoint) throw new Error('Module initialise is missing MODULE_ENTRYPOINT')

const manifestPath = process.env.MODULE_MANIFEST
if (!manifestPath) throw new Error('Module initialise is missing MODULE_MANIFEST')

// check manifest api field against apiVersion
const manifestBlob = await fs.readFile(manifestPath, 'utf-8')
const manifestJson: Partial<ModuleManifest> = JSON.parse(manifestBlob)

if (!manifestJson.runtime?.apiVersion) throw new Error(`Module manifest 'apiVersion' missing`)

if (!process.send) throw new Error('Module is not being run with ipc')

console.log(`Starting up connection module: ${manifestJson.id}`)

const verificationToken = process.env.VERIFICATION_TOKEN
if (typeof verificationToken !== 'string' || !verificationToken)
	throw new Error('Module initialise is missing VERIFICATION_TOKEN')

const logger = createModuleLogger('Entrypoint')

let instance: InstanceWrapper<any> | null = null
let hostContext: HostContext<any, any> | null = null
let instanceInitialized = false

// The connection id needed to build the instance only arrives in the response to 'register', so the module
// cannot be imported until after we have registered. The host sends 'init' as soon as it has answered that
// registration, which can easily beat the import - so 'init' waits for the instance rather than rejecting.
const { promise: instanceReady, resolve: resolveInstanceReady } = Promise.withResolvers<void>()

// Setup the ipc wrapper, the plugin may not yet exist, but this is better so that we can send log lines out
const ipcWrapper = new IpcWrapper<ModuleToHostEventsNew, HostToModuleEventsNew>(
	{
		init: async (msg): Promise<InitResponseMessage> => {
			// May arrive before the module import has finished; the host allows time for this
			await instanceReady
			if (!instance) throw new Error('Not ready for init')

			const res = await instance.init(msg)

			instanceInitialized = true

			logger.info('Module initialized successfully')

			return res
		},
		destroy: async (): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.destroy()

			// Release any pending timers (e.g. the batched variable value flush)
			hostContext?.destroy()
		},

		updateConfig: async (msg): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.configUpdateAndLabel(msg.label, msg.config, msg.secrets)
		},
		updateFeedbacks: async (msg: UpdateFeedbackInstancesMessage): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.updateFeedbacks(msg.feedbacks)
		},
		updateActions: async (msg: UpdateActionInstancesMessage): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.updateActions(msg.actions)
		},
		upgradeActions: async (msg): Promise<UpgradeActionsResponse> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			const res = await instance.upgradeActionsAndFeedbacks(msg.defaultUpgradeIndex, msg.actions, [])
			return {
				updatedActions: res.updatedActions,
				latestUpgradeIndex: res.latestUpgradeIndex,
			}
		},
		upgradeFeedbacks: async (msg): Promise<UpgradeFeedbacksResponse> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			const res = await instance.upgradeActionsAndFeedbacks(msg.defaultUpgradeIndex, [], msg.feedbacks)
			return {
				updatedFeedbacks: res.updatedFeedbacks,
				latestUpgradeIndex: res.latestUpgradeIndex,
			}
		},
		executeAction: async (msg): Promise<ExecuteActionResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			const res = await instance.executeAction(msg.action, msg.surfaceId)
			return res.success
				? {
						success: true,
						result: res.result,
					}
				: {
						success: false,
						errorMessage: res.errorMessage,
					}
		},
		getConfigFields: async (): Promise<GetConfigFieldsResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			const fields = await instance.getConfigFields()
			return {
				fields: translateConnectionConfigFields(fields),
			}
		},
		handleHttpRequest: async (msg): Promise<HandleHttpRequestResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			return {
				response: await instance.httpRequest(msg.request),
			}
		},
		learnAction: async (msg, signal): Promise<LearnActionResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			return instance.learnActionWithSignal(msg.action, signal)
		},
		learnFeedback: async (msg, signal): Promise<LearnFeedbackResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			return instance.learnFeedbackWithSignal(msg.feedback, signal)
		},

		startStopRecordActions: async (msg): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.startStopRecordActions(msg.recording)
		},
		sharedUdpSocketMessage: async (msg): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.sharedUdpSocketMessage({
				handleId: msg.handleId,
				portNumber: msg.portNumber,
				message: Buffer.from(msg.message, 'base64'),
				source: msg.source,
			})
		},
		sharedUdpSocketError: async (msg): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.sharedUdpSocketError({
				handleId: msg.handleId,
				portNumber: msg.portNumber,

				errorMessage: msg.errorMessage,
				errorStack: undefined, // TODO - provide a stack?
			})
		},
	},
	(msg) => {
		process.send!(msg)
	},
	5000
)
process.on('message', (msg) => ipcWrapper.receivedMessage(msg as any))
process.on('disconnect', () => process.exit())

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

ipcWrapper
	.sendWithCb('register', {
		verificationToken,
	})
	.then(async (msg) => {
		logger.info(`Module-host accepted registration`)

		const moduleImport = await importModuleFromPath(moduleEntrypoint)
		const moduleConstructor = typeof moduleImport === 'function' ? moduleImport : moduleImport.default
		if (typeof moduleConstructor !== 'function')
			throw new Error(`Module entrypoint did not return a valid constructor function`)

		const moduleUpgradeScripts = moduleImport.UpgradeScripts ?? []
		if (!Array.isArray(moduleUpgradeScripts)) throw new Error(`Module entrypoint upgradeScripts is not an array`)

		logger.info(`Found module entrypoint, with ${moduleUpgradeScripts.length} upgrade scripts`)

		// Now load the plugin
		hostContext = new HostContext(ipcWrapper, msg.connectionId, moduleUpgradeScripts.length - 1)
		instance = new InstanceWrapper(
			msg.connectionId,
			hostContext,
			moduleConstructor,
			moduleUpgradeScripts,
			msg.moduleApiVersion
		)

		// Release any 'init' that beat the import here
		resolveInstanceReady()
	})
	.catch((err) => {
		logger.error(`Module registration failed: ${err}`)

		// Kill the process
		process.exit(11)
	})
