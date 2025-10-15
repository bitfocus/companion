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
	configStore: InstanceConfigStore
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

		setConfig: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					label: z.string(),
					enabled: z.boolean().optional(),
					config: z.record(z.string(), z.any()).optional(),
					secrets: z.record(z.string(), z.any()).optional(),
					updatePolicy: z.enum(InstanceVersionUpdatePolicy).optional(),
				})
			)
			.mutation(({ input }) => {
				logger.info('Updating config for ', input.connectionId, input.label)

				const res = instanceController.setConnectionLabelAndConfig(input.connectionId, {
					label: input.label,
					enabled: input.enabled ?? null,
					config: input.config ?? null,
					secrets: input.secrets ?? null,
					updatePolicy: input.updatePolicy ?? null,
					upgradeIndex: null,
				})

				if (!res.ok) return res.message

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
				const res = instanceController.setModuleVersionAndActivate(
					input.connectionId,
					`${input.moduleId}@${input.versionId ?? ''}`,
					null
				)

				if (!res) return 'no connection' // Update the config

				return null
			}),
	})
}
