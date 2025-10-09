import { isLabelValid } from '@companion-app/shared/Label.js'
import type { ClientEditConnectionConfig } from '@companion-app/shared/Model/Common.js'
import { ClientSurfaceInstancesUpdate } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import z from 'zod'
import { publicProcedure, router, toIterable } from '../../UI/TRPC.js'
import { translateConnectionConfigFields } from '../ConfigFields.js'
import type { InstanceController, InstanceControllerEvents } from '../Controller.js'
import { InstanceConfigStore } from '../ConfigStore.js'
import type { Logger } from '../../Log/Controller.js'
import type EventEmitter from 'events'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSurfacesTrpcRouter(
	logger: Logger,
	instanceController: InstanceController,
	instanceEvents: EventEmitter<InstanceControllerEvents>,
	configStore: InstanceConfigStore,
	queueUpdateSurfaceState: (id: string, forceCommitChanges?: boolean, forceRestart?: boolean) => void
) {
	return router({
		watch: publicProcedure.subscription(async function* ({ signal }) {
			const changes = toIterable(instanceEvents, 'uiSurfaceInstancesUpdate', signal)

			// Get surface instances using the proper method
			const surfaceClientJson = instanceController.getSurfaceInstanceClientJson()

			yield [{ type: 'init', info: surfaceClientJson }] satisfies ClientSurfaceInstancesUpdate[]

			for await (const [change] of changes) {
				yield change
			}
		}),

		add: publicProcedure
			.input(
				z.object({
					moduleId: z.string(),
					label: z.string(),
					versionId: z.string(),
				})
			)
			.mutation(({ input }) => {
				const surfaceInfo = instanceController.addSurfaceInstanceWithLabel(input.moduleId, input.label, {
					versionId: input.versionId,
					updatePolicy: InstanceVersionUpdatePolicy.Stable,
					disabled: false,
				})
				return surfaceInfo[0]
			}),

		delete: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				await instanceController.removeSurfaceInstance(input.instanceId)
			}),

		setEnabled: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
					enabled: z.boolean(),
				})
			)
			.mutation(({ input }) => {
				instanceController.enableDisableSurfaceInstance(input.instanceId, input.enabled)
			}),

		edit: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
				})
			)
			.query(async ({ input }) => {
				// Check if the surface instance exists
				const instanceConf = configStore.getConfigOfTypeForId(input.instanceId, ModuleInstanceType.Surface)
				if (!instanceConf) return null

				const instance = instanceController.processManager.getSurfaceChild(input.instanceId)
				if (!instance) return null

				try {
					const fields: never[] = [] // TODO
					// const fields = await instance.requestConfigFields()

					const result: ClientEditConnectionConfig = {
						fields: translateConnectionConfigFields(fields),
						config: instanceConf.config,
						secrets: instanceConf.secrets || {},
					}
					return result
				} catch (e: any) {
					logger.silly(`Failed to load surface config_fields: ${e.message}`)
					return null
				}
			}),

		setLabelAndConfig: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
					label: z.string(),
					config: z.record(z.string(), z.any()),
					updatePolicy: z.enum(InstanceVersionUpdatePolicy),
				})
			)
			.mutation(({ input }) => {
				const config = configStore.getConfigOfTypeForId(input.instanceId, ModuleInstanceType.Surface)
				if (!config) return 'no surface instance'

				const idUsingLabel = instanceController.getIdForLabel(input.label)
				if (idUsingLabel && idUsingLabel !== input.instanceId) {
					return 'duplicate label'
				}

				if (!isLabelValid(input.label)) {
					return 'invalid label'
				}

				instanceController.setSurfaceInstanceLabelAndConfig(input.instanceId, {
					label: input.label,
					config: input.config,
					updatePolicy: input.updatePolicy,
				})

				return null
			}),

		setLabelAndVersion: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
					label: z.string(),
					versionId: z.string().nullable(),
					updatePolicy: z.enum(InstanceVersionUpdatePolicy).nullable(),
				})
			)
			.mutation(({ input }) => {
				logger.info('Setting surface instance label and version', input.instanceId, input.label, input.versionId)

				const config = configStore.getConfigOfTypeForId(input.instanceId, ModuleInstanceType.Surface)
				if (!config) return 'no surface instance'

				const idUsingLabel = instanceController.getIdForLabel(input.label)
				if (idUsingLabel && idUsingLabel !== input.instanceId) {
					return 'duplicate label'
				}

				if (!isLabelValid(input.label)) {
					return 'invalid label'
				}

				instanceController.setSurfaceInstanceLabelAndConfig(input.instanceId, {
					label: input.label,
					config: null,
					updatePolicy: null,
				})

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
				configStore.commitChanges([input.instanceId], false)

				// Install the module if needed
				instanceController.userModulesManager.ensureModuleIsInstalled(
					ModuleInstanceType.Surface,
					config.instance_type,
					config.moduleVersionId
				)

				// Trigger a restart (or as much as possible)
				if (config.enabled) {
					queueUpdateSurfaceState(input.instanceId, false, true)
				}

				return null
			}),

		setModuleAndVersion: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
					moduleId: z.string(),
					versionId: z.string().nullable(),
				})
			)
			.mutation(({ input }) => {
				const config = configStore.getConfigOfTypeForId(input.instanceId, ModuleInstanceType.Surface)
				if (!config) return 'no surface instance' // Update the config
				config.instance_type = input.moduleId
				config.moduleVersionId = input.versionId
				configStore.commitChanges([input.instanceId], false)

				// Install the module if needed
				instanceController.userModulesManager.ensureModuleIsInstalled(
					ModuleInstanceType.Surface,
					config.instance_type,
					input.versionId
				)

				// Trigger a restart (or as much as possible)
				if (config.enabled) {
					queueUpdateSurfaceState(input.instanceId, false, true)
				}

				return null
			}),
	})
}
