import type EventEmitter from 'node:events'
import z from 'zod'
import type { ClientConnectionsUpdate } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy } from '@companion-app/shared/Model/Instance.js'
import { JsonObjectSchema } from '@companion-app/shared/Model/Options.js'
import type { Logger } from '../../Log/Controller.js'
import { publicProcedure, router, toIterable } from '../../UI/TRPC.js'
import type { InstanceConfigStore } from '../ConfigStore.js'
import type { InstanceController, InstanceControllerEvents } from '../Controller.js'
import { ConnectionOperationError, ConnectionOperations } from './ConnectionOperations.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createConnectionsTrpcRouter(
	logger: Logger,
	instanceController: InstanceController,
	instanceEvents: EventEmitter<InstanceControllerEvents>,
	configStore: InstanceConfigStore
) {
	const connectionOperations = new ConnectionOperations({ logger, instanceController, configStore })

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
			.mutation(async ({ input }) => {
				return connectionOperations.createConnection({
					moduleId: input.module.type,
					product: input.module.product,
					label: input.label,
					versionId: input.versionId,
					updatePolicy: InstanceVersionUpdatePolicy.Stable,
					disabled: false,
				})
			}),

		delete: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				await connectionOperations.deleteConnection(input.connectionId)
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
				connectionOperations.reorderConnection(input)
			}),

		setEnabled: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					enabled: z.boolean(),
				})
			)
			.mutation(({ input }) => {
				connectionOperations.setConnectionEnabled(input.connectionId, input.enabled)
			}),

		edit: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
				})
			)
			.query(async ({ input }) => {
				return connectionOperations.getConnectionEditConfig(input.connectionId)
			}),

		setConfig: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
					label: z.string(),
					enabled: z.boolean().optional(),
					config: JsonObjectSchema.optional(),
					secrets: JsonObjectSchema.optional(),
					updatePolicy: z.enum(InstanceVersionUpdatePolicy).optional(),
				})
			)
			.mutation(async ({ input }) => {
				logger.info('Updating config for ', input.connectionId, input.label)

				try {
					await connectionOperations.setConnectionConfig({
						connectionId: input.connectionId,
						label: input.label,
						enabled: input.enabled,
						config: input.config,
						secrets: input.secrets,
						updatePolicy: input.updatePolicy,
					})
				} catch (e) {
					if (e instanceof ConnectionOperationError) return e.message
					throw e
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
			.mutation(async ({ input }) => {
				try {
					await connectionOperations.setConnectionModuleVersion({
						connectionId: input.connectionId,
						moduleId: input.moduleId,
						versionId: input.versionId,
					})
				} catch (e) {
					if (e instanceof ConnectionOperationError) return e.message
					throw e
				}

				return null
			}),
	})
}
