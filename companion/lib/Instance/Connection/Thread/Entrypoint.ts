/* eslint-disable n/no-process-exit */
import { IpcWrapper } from '../../Common/IpcWrapper.js'
import type {
	ModuleToHostEventsNew,
	HostToModuleEventsNew,
	ExecuteActionResponseMessage,
	GetConfigFieldsResponseMessage,
	HandleHttpRequestResponseMessage,
	LearnActionResponseMessage,
	LearnFeedbackResponseMessage,
	InitResponseMessage,
	UpdateFeedbackInstancesMessage,
	UpdateActionInstancesMessage,
	UpgradeActionsResponse,
	UpgradeFeedbacksResponse,
} from '../IpcTypesNew.js'
import { registerLoggingSink, createModuleLogger, InstanceWrapper } from '@companion-module/host'
import type { ModuleManifest } from '@companion-module/base/manifest'
import fs from 'fs/promises'
import { HostContext } from './HostContext.js'
import { translateConnectionConfigFields } from '../ConfigFields.js'
// eslint-disable-next-line n/no-missing-import
import { serializeIsVisibleFn } from '@companion-module/base-old/dist/internal/base.js'

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

let instance: InstanceWrapper<any, any> | null = null
let instanceInitialized = false

// Setup the ipc wrapper, the plugin may not yet exist, but this is better so that we can send log lines out
const ipcWrapper = new IpcWrapper<ModuleToHostEventsNew, HostToModuleEventsNew>(
	{
		init: async (msg): Promise<InitResponseMessage> => {
			if (!instance) throw new Error('Not ready for init')

			const res = await instance.init(msg)

			instanceInitialized = true

			logger.info('Module initialized successfully')

			return res
		},
		destroy: async (): Promise<void> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			await instance.destroy()
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
			return {
				success: res.success,
				errorMessage: res.errorMessage,
			}
		},
		getConfigFields: async (): Promise<GetConfigFieldsResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			const fields = await instance.getConfigFields()
			return {
				// TODO - simplify/streamline this
				fields: translateConnectionConfigFields(serializeIsVisibleFn(fields)),
			}
		},
		handleHttpRequest: async (msg): Promise<HandleHttpRequestResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			return {
				response: await instance.httpRequest(msg.request),
			}
		},
		learnAction: async (msg): Promise<LearnActionResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			return instance.learnAction(msg.action)
		},
		learnFeedback: async (msg): Promise<LearnFeedbackResponseMessage> => {
			if (!instance || !instanceInitialized) throw new Error('Not initialized')

			return instance.learnFeedback(msg.feedback)
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

// Load the module code, setting up the global
// Future: When hitting 2.0 of the module/base API, this should move to be a default+named exports instead
if (typeof __non_webpack_require__ === 'function') {
	__non_webpack_require__(moduleEntrypoint)
} else {
	await import(ensureFileUrl(moduleEntrypoint))
}

const moduleEntrypointInfo = global.COMPANION_ENTRYPOINT_INFO
if (!moduleEntrypointInfo) {
	throw new Error('Module did not call runEntrypoint')
}

ipcWrapper
	.sendWithCb('register', {
		verificationToken,
	})
	.then(async (msg) => {
		logger.info(`Module-host accepted registration`)

		// Now load the plugin
		instance = new InstanceWrapper(
			msg.connectionId,
			new HostContext(ipcWrapper, msg.connectionId, moduleEntrypointInfo.upgradeScripts.length - 1),
			moduleEntrypointInfo.factory,
			moduleEntrypointInfo.upgradeScripts
		)
	})
	.catch((err) => {
		logger.error(`Module registration failed: ${err}`)

		// Kill the process
		process.exit(11)
	})
