/* eslint-disable no-process-exit */

import { CompanionStaticUpgradeScript, InstanceBase, ModuleManifest } from '@companion-module/base'
import { HostApiNodeJsIpc, HostToModuleEventsInit, ModuleToHostEventsInit } from './host-api/versions'
import fs from 'fs/promises'
import { InstanceConstructor, InternalApiGenerator } from '@companion-module/base/dist/entrypoint'
import { configureScope, init } from '@sentry/node'
import '@sentry/tracing'
import { IpcWrapper } from './host-api/ipc-wrapper'
import { CompanionInstanceApiImpl } from './newapi'

const createInstanceApi: InternalApiGenerator<any> = async <TConfig>(
	factory: InstanceConstructor<TConfig>,
	upgradeScripts: CompanionStaticUpgradeScript<TConfig>[]
): Promise<InstanceBase<TConfig>> => {
	const manifestPath = process.env.MODULE_MANIFEST
	if (!manifestPath) throw new Error('Module initialise is missing MODULE_MANIFEST')

	// check manifest api field against apiVersion
	const manifestBlob = await fs.readFile(manifestPath)
	const manifestJson: Partial<ModuleManifest> = JSON.parse(manifestBlob.toString())

	if (manifestJson.runtime?.api !== HostApiNodeJsIpc) throw new Error(`Module manifest 'api' mismatch`)
	if (!manifestJson.runtime.apiVersion) throw new Error(`Module manifest 'apiVersion' missing`)
	const apiVersion = manifestJson.runtime.apiVersion

	if (!process.send) throw new Error('Module is not being run with ipc')

	console.log(`Starting up module class: ${factory.name}`)

	const connectionId = process.env.CONNECTION_ID
	if (typeof connectionId !== 'string' || !connectionId) throw new Error('Module initialise is missing CONNECTION_ID')

	const verificationToken = process.env.VERIFICATION_TOKEN
	if (typeof verificationToken !== 'string' || !verificationToken)
		throw new Error('Module initialise is missing VERIFICATION_TOKEN')

	// Allow the DSN to be provided as an env variable
	const sentryDsn = process.env.SENTRY_DSN
	const sentryUserId = process.env.SENTRY_USERID
	const sentryCompanionVersion = process.env.SENTRY_COMPANION_VERSION
	if (sentryDsn && sentryUserId && sentryDsn.substring(0, 8) == 'https://') {
		console.log('Sentry enabled')

		init({
			dsn: sentryDsn,
			release: `${manifestJson.name}@${manifestJson.version}`,
			beforeSend(event) {
				if (event.exception) {
					console.log('sentry', 'error', event.exception)
				}
				return event
			},
		})

		configureScope((scope) => {
			scope.setUser({ id: sentryUserId })
			scope.setTag('companion', sentryCompanionVersion)
		})
	} else {
		console.log('Sentry disabled')
	}

	const ipcWrapper = new IpcWrapper<ModuleToHostEventsInit, HostToModuleEventsInit>(
		{},
		(msg) => {
			process.send!(msg)
		},
		5000
	)
	process.once('message', (msg: any) => {
		ipcWrapper.receivedMessage(msg)
	})

	const internalApi = new CompanionInstanceApiImpl(connectionId, upgradeScripts)

	const moduleInstance = new factory(internalApi)

	ipcWrapper
		.sendWithCb('register', {
			apiVersion: apiVersion,
			connectionId: connectionId,
			verificationToken: verificationToken,
		})
		.then(
			() => {
				console.log(`Module-host accepted registration`)
			},
			(err) => {
				console.error('Module registration failed', err)
				// Kill the process
				process.exit(11)
			}
		)

	return moduleInstance
}

export default createInstanceApi
