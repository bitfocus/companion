import type EventEmitter from 'node:events'
import z from 'zod'
import type { ClientEditInstanceConfigState } from '@companion-app/shared/Model/Common.js'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { JsonObjectSchema } from '@companion-app/shared/Model/Options.js'
import type { ClientSurfaceInstancesUpdate } from '@companion-app/shared/Model/SurfaceInstance.js'
import type { Logger } from '../../Log/Controller.js'
import { mergeEventTriggers, publicProcedure, router, toIterable } from '../../UI/TRPC.js'
import type { InstanceConfigStore } from '../ConfigStore.js'
import type { InstanceController, InstanceControllerEvents } from '../Controller.js'
import { computeInstanceConfigState } from '../EditConfigState.js'

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

			// Get surface integrations using the proper method
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
				const surfaceIds = configStore.getAllInstanceIdsOfType(ModuleInstanceType.Surface)
				let existingCount = 0
				for (const id of surfaceIds) {
					const conf = configStore.getConfigOfTypeForId(id, ModuleInstanceType.Surface)
					if (conf && conf.moduleId === input.moduleId) {
						existingCount++
					}
				}

				const moduleInfo = instanceController.modules.getModuleManifest(
					ModuleInstanceType.Surface,
					input.moduleId,
					input.versionId
				)
				const allowMultiple =
					moduleInfo?.manifest.type === 'surface' ? (moduleInfo.manifest.allowMultipleInstances ?? false) : false

				const shouldBeDisabled = existingCount > 0 && !allowMultiple

				const surfaceInfo = instanceController.addSurfaceInstanceWithLabel(input.moduleId, input.label, {
					versionId: input.versionId,
					updatePolicy: InstanceVersionUpdatePolicy.Stable,
					disabled: shouldBeDisabled,
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

		watchEdit: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
				})
			)
			.subscription(async function* ({ input, signal }) {
				const { instanceId } = input

				if (!signal) throw new Error('No signal in watchEdit subscription')

				const triggers = mergeEventTriggers(signal, [
					// config saved / module changed / enable-disable
					{ ee: instanceEvents, key: 'surface_instance_updated', filter: (id) => id === instanceId },
					// a collection was enabled/disabled (no id payload, so always re-evaluate)
					{ ee: instanceEvents, key: 'surface_collections_enabled' },
					// the child process became ready / stopped / crashed
					{ ee: instanceController.processManager, key: 'childStateChange', filter: (id) => id === instanceId },
				])

				// Emit the initial state, then recompute and emit whenever something relevant changes.
				yield await loadSurfaceConfigState(instanceController, configStore, instanceId)

				for await (const _trigger of triggers) {
					yield await loadSurfaceConfigState(instanceController, configStore, instanceId)
				}
			}),

		setConfig: publicProcedure
			.input(
				z.object({
					instanceId: z.string(),
					label: z.string(),
					enabled: z.boolean().optional(),
					config: JsonObjectSchema.optional(),
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

				if (!res) return 'no surface integration' // Update the config

				return null
			}),
	})
}

/**
 * Compute the current state of the config-fields editor for a surface instance. The shared helper owns
 * the lifecycle reasoning; surfaces do not expose config fields yet, so a running child reports an
 * empty field set.
 */
async function loadSurfaceConfigState(
	instanceController: InstanceController,
	configStore: InstanceConfigStore,
	instanceId: string
): Promise<ClientEditInstanceConfigState> {
	return computeInstanceConfigState(
		instanceController,
		configStore,
		ModuleInstanceType.Surface,
		instanceId,
		() => instanceController.processManager.getSurfaceChild(instanceId),
		(_instance, instanceConf) => ({
			// TODO: surface modules do not expose config fields yet
			type: 'config',
			fields: [],
			useNewLayout: true,
			config: instanceConf.config,
			secrets: instanceConf.secrets || {},
		})
	)
}
