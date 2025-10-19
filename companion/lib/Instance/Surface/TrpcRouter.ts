import type { ClientEditInstanceConfig } from '@companion-app/shared/Model/Common.js'
import type { ClientSurfaceInstancesUpdate } from '@companion-app/shared/Model/SurfaceInstance.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import z from 'zod'
import { publicProcedure, router, toIterable } from '../../UI/TRPC.js'
import { translateConnectionConfigFields } from '../ConfigFields.js'
import type { InstanceController, InstanceControllerEvents } from '../Controller.js'
import type { InstanceConfigStore } from '../ConfigStore.js'
import type { Logger } from '../../Log/Controller.js'
import type EventEmitter from 'events'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createSurfacesTrpcRouter(
	logger: Logger,
	instanceController: InstanceController,
	instanceEvents: EventEmitter<InstanceControllerEvents>,
	configStore: InstanceConfigStore
) {
	return router({
		collections: instanceController.surfaceInstanceCollections.createTrpcRouter(),

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

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					connectionId: z.string(),
					dropIndex: z.number(),
				})
			)
			.mutation(({ input }) => {
				configStore.moveInstance(input.collectionId, ModuleInstanceType.Surface, input.connectionId, input.dropIndex)
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

					const result: ClientEditInstanceConfig = {
						fields: translateConnectionConfigFields(fields),
						useNewLayout: true,
						config: instanceConf.config,
						secrets: instanceConf.secrets || {},
					}
					return result
				} catch (e: any) {
					logger.silly(`Failed to load surface config_fields: ${e.message}`)
					return null
				}
			}),

		setConfig: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
					label: z.string(),
					enabled: z.boolean().optional(),
					config: z.record(z.string(), z.any()).optional(),
					updatePolicy: z.enum(InstanceVersionUpdatePolicy).optional(),
				})
			)
			.mutation(({ input }) => {
				logger.info('Updating config for ', input.instanceId, input.label)

				const res = instanceController.setSurfaceInstanceLabelAndConfig(input.instanceId, {
					label: input.label,
					enabled: input.enabled ?? null,
					config: input.config ?? null,
					updatePolicy: input.updatePolicy ?? null,
				})

				if (!res.ok) return res.message

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
				const res = instanceController.setModuleVersionAndActivate(
					input.instanceId,
					`${input.moduleId}@${input.versionId ?? ''}`,
					null
				)

				if (!res) return 'no surface instance' // Update the config

				return null
			}),
	})
}
