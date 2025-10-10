import { isLabelValid } from '@companion-app/shared/Label.js'
import type { ClientEditConnectionConfig } from '@companion-app/shared/Model/Common.js'
import type { ClientConnectionsUpdate } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import z from 'zod'
import { publicProcedure, router, toIterable } from '../../UI/TRPC.js'
import { translateConnectionConfigFields } from '../ConfigFields.js'
import type { InstanceController, InstanceControllerEvents } from '../Controller.js'
import { InstanceConfigStore } from '../ConfigStore.js'
import type { Logger } from '../../Log/Controller.js'
import type EventEmitter from 'events'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createConnectionsTrpcRouter(
	logger: Logger,
	instanceController: InstanceController,
	instanceEvents: EventEmitter<InstanceControllerEvents>,
	configStore: InstanceConfigStore,
	queueUpdateConnectionState: (id: string, forceCommitChanges?: boolean, forceRestart?: boolean) => void
) {
	return router({
		collections: instanceController.connectionCollections.createTrpcRouter(),

		watch: publicProcedure.subscription(async function* ({ signal }) {
			const changes = toIterable(instanceEvents, 'uiConnectionsUpdate', signal)

			yield [
				{ type: 'init', info: instanceController.getConnectionClientJson(true) },
			] satisfies ClientConnectionsUpdate[]

			for await (const [change] of changes) {
				yield change
			}
		}),

		add: publicProcedure
			.input(
				z.object({
					module: z.object({
						type: z.string(),
						product: z.string().optional(),
					}),
					label: z.string(),
					versionId: z.string(),
				})
			)
			.mutation(({ input }) => {
				const connectionInfo = instanceController.addConnectionWithLabel(input.module, input.label, {
					versionId: input.versionId,
					updatePolicy: InstanceVersionUpdatePolicy.Stable,
					disabled: false,
				})
				return connectionInfo[0]
			}),

		delete: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				await instanceController.removeConnection(input.connectionId)
			}),

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					connectionId: z.string(),
					dropIndex: z.number(),
				})
			)
			.mutation(({ input }) => {
				configStore.moveConnection(input.collectionId, input.connectionId, input.dropIndex)
			}),

		setEnabled: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					enabled: z.boolean(),
				})
			)
			.mutation(({ input }) => {
				instanceController.enableDisableConnection(input.connectionId, input.enabled)
			}),

		edit: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
				})
			)
			.query(async ({ input }) => {
				// Check if the instance exists
				const instanceConf = configStore.getConfigOfTypeForId(input.connectionId, ModuleInstanceType.Connection)
				if (!instanceConf) return null

				// Make sure the collection is enabled
				if (!instanceController.connectionCollections.isCollectionEnabled(instanceConf.collectionId)) return null

				const instance = instanceController.processManager.getConnectionChild(input.connectionId)
				if (!instance) return null

				try {
					const fields = await instance.requestConfigFields()

					const result: ClientEditConnectionConfig = {
						fields: translateConnectionConfigFields(fields),
						config: instanceConf.config,
						secrets: instanceConf.secrets || {},
					}
					return result
				} catch (e: any) {
					logger.silly(`Failed to load instance config_fields: ${e.message}`)
					return null
				}
			}),

		setLabelAndConfig: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					label: z.string(),
					config: z.record(z.string(), z.any()),
					secrets: z.record(z.string(), z.any()),
					updatePolicy: z.enum(InstanceVersionUpdatePolicy),
				})
			)
			.mutation(({ input }) => {
				const config = configStore.getConfigOfTypeForId(input.connectionId, ModuleInstanceType.Connection)
				if (!config) return 'no connection'

				const idUsingLabel = instanceController.getIdForLabel(input.label)
				if (idUsingLabel && idUsingLabel !== input.connectionId) {
					return 'duplicate label'
				}

				if (!isLabelValid(input.label)) {
					return 'invalid label'
				}

				instanceController.setConnectionLabelAndConfig(input.connectionId, {
					label: input.label,
					config: input.config,
					secrets: input.secrets,
					updatePolicy: input.updatePolicy,
					upgradeIndex: null,
				})

				return null
			}),

		setLabelAndVersion: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					label: z.string(),
					versionId: z.string().nullable(),
					updatePolicy: z.enum(InstanceVersionUpdatePolicy).nullable(),
				})
			)
			.mutation(({ input }) => {
				logger.info('Setting label and version', input.connectionId, input.label, input.versionId)

				const config = configStore.getConfigOfTypeForId(input.connectionId, ModuleInstanceType.Connection)
				if (!config) return 'no connection'

				const idUsingLabel = instanceController.getIdForLabel(input.label)
				if (idUsingLabel && idUsingLabel !== input.connectionId) {
					return 'duplicate label'
				}

				if (!isLabelValid(input.label)) {
					return 'invalid label'
				}

				// TODO - refactor/optimise/tidy this

				instanceController.setConnectionLabelAndConfig(input.connectionId, {
					label: input.label,
					config: null,
					secrets: null,
					updatePolicy: null,
					upgradeIndex: null,
				})

				// Don't validate the version, as it might not yet be installed
				// const moduleInfo = instanceController.modules.getModuleManifest(config.instance_type, versionId)
				// if (!moduleInfo) throw new Error(`Unknown module type or version ${config.instance_type} (${versionId})`)

				if (input.versionId?.includes('@')) {
					// Its a moduleId and version
					const [moduleId, version] = input.versionId.split('@')
					config.instance_type = moduleId
					config.moduleVersionId = version || null
				} else {
					// Its a simple version
					config.moduleVersionId = input.versionId
				}

				// Update the config
				if (input.updatePolicy) config.updatePolicy = input.updatePolicy
				configStore.commitChanges([input.connectionId], false)

				// Install the module if needed
				instanceController.userModulesManager.ensureModuleIsInstalled(
					ModuleInstanceType.Connection,
					config.instance_type,
					config.moduleVersionId
				)

				// Trigger a restart (or as much as possible)
				if (config.enabled) {
					queueUpdateConnectionState(input.connectionId, false, true)
				}

				return null
			}),

		setModuleAndVersion: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					moduleId: z.string(),
					versionId: z.string().nullable(),
				})
			)
			.mutation(({ input }) => {
				const config = configStore.getConfigOfTypeForId(input.connectionId, ModuleInstanceType.Connection)
				if (!config) return 'no connection'

				// Don't validate the version, as it might not yet be installed
				// const moduleInfo = instanceController.modules.getModuleManifest(config.instance_type, versionId)
				// if (!moduleInfo) throw new Error(`Unknown module type or version ${config.instance_type} (${versionId})`)

				// Update the config
				config.instance_type = input.moduleId
				config.moduleVersionId = input.versionId
				// if (updatePolicy) config.updatePolicy = updatePolicy
				configStore.commitChanges([input.connectionId], false)

				// Install the module if needed
				instanceController.userModulesManager.ensureModuleIsInstalled(
					ModuleInstanceType.Connection,
					config.instance_type,
					input.versionId
				)

				// Trigger a restart (or as much as possible)
				if (config.enabled) {
					queueUpdateConnectionState(input.connectionId, false, true)
				}

				return null
			}),
	})
}
