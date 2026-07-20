import type EventEmitter from 'node:events'
import z from 'zod'
import type { ClientEditInstanceConfigState } from '@companion-app/shared/Model/Common.js'
import type { ClientConnectionsUpdate } from '@companion-app/shared/Model/Connections.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { JsonObjectSchema, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import type { Logger } from '../../Log/Controller.js'
import { mergeEventTriggers, publicProcedure, router, toIterable } from '../../UI/TRPC.js'
import type { InstanceConfigStore } from '../ConfigStore.js'
import type { InstanceController, InstanceControllerEvents } from '../Controller.js'
import { computeInstanceConfigState } from '../EditConfigState.js'
import { ConnectionOperationError, ConnectionOperations } from './ConnectionOperations.js'

/**
 * Ensure every field has a unique id.
 *
 * Some modules incorrectly reuse the same id for multiple `static-text` fields. This breaks React (duplicate keys),
 * but since these fields are purely visual and have no value, we can safely give each one a unique but stable id by
 * suffixing it with its index in the array.
 */
function ensureUniqueFieldIds(fields: SomeCompanionInputField[]): SomeCompanionInputField[] {
	return fields.map((field, index) => {
		if (field.type !== 'static-text') return field

		return { ...field, id: `${field.id}_${index}` }
	})
}

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

		watchEdit: publicProcedure
			.input(
				z.object({
					connectionId: z.string(),
				})
			)
			.subscription(async function* ({ input, signal }) {
				const { connectionId } = input

				if (!signal) throw new Error('No signal in watchEdit subscription')

				const triggers = mergeEventTriggers(signal, [
					// config saved / module changed / enable-disable
					{ ee: instanceEvents, key: 'connection_updated', filter: (id) => id === connectionId },
					// a collection was enabled/disabled (no id payload, so always re-evaluate)
					{ ee: instanceEvents, key: 'connection_collections_enabled' },
					// the child process became ready / stopped / crashed
					{ ee: instanceController.processManager, key: 'childStateChange', filter: (id) => id === connectionId },
				])

				// Emit the initial state, then recompute and emit whenever something relevant changes. Each
				// recompute is awaited fully before the next trigger is handled, so requestConfigFields calls
				// never overlap.
				yield await loadConnectionConfigState(logger, instanceController, configStore, connectionId)

				for await (const _trigger of triggers) {
					yield await loadConnectionConfigState(logger, instanceController, configStore, connectionId)
				}
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

/**
 * Compute the current state of the config-fields editor for a connection. The shared helper owns the
 * lifecycle reasoning; the connection only provides how to reach the child and load its config fields.
 */
async function loadConnectionConfigState(
	logger: Logger,
	instanceController: InstanceController,
	configStore: InstanceConfigStore,
	connectionId: string
): Promise<ClientEditInstanceConfigState> {
	return computeInstanceConfigState(
		instanceController,
		configStore,
		ModuleInstanceType.Connection,
		connectionId,
		() => instanceController.processManager.getConnectionChild(connectionId),
		async (instance, instanceConf) => {
			try {
				const fields = await instance.requestConfigFields()

				return {
					type: 'config',
					fields: ensureUniqueFieldIds(fields),
					useNewLayout: instance.usesNewConfigLayout,
					config: instanceConf.config,
					secrets: instanceConf.secrets || {},
				}
			} catch (e) {
				logger.silly(`Failed to load instance config_fields: ${stringifyError(e)}`)
				return { type: 'error', message: 'Failed to load configuration fields' }
			}
		}
	)
}
