import z from 'zod'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import {
	EntityModelType,
	type EntityOwner,
	schemaFeedbackEntityStyleOverride,
	zodEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ActiveLearningStore } from '../Resources/ActiveLearningStore.js'
import LogController from '../Log/Controller.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'

const zodEntityOwner: z.ZodSchema<EntityOwner> = z.object({
	parentId: z.string(),
	childGroup: z.string(),
})

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createEntitiesTrpcRouter(
	controlsMap: Map<string, SomeControl<any>>,
	instanceDefinitions: InstanceDefinitions,
	activeLearningStore: ActiveLearningStore
) {
	const logger = LogController.createLogger('Controls/EntitiesTrpcRouter')

	return router({
		add: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					ownerId: zodEntityOwner.nullable(),
					connectionId: z.string(),
					entityType: z.enum(EntityModelType),
					entityDefinition: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, ownerId, connectionId, entityType, entityDefinition } = input

				const control = controlsMap.get(controlId)
				if (!control) return null

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				const newEntity = instanceDefinitions.createEntityItem(
					connectionId,
					entityType,
					entityDefinition,
					control.supportsLayeredStyle && entityLocation === 'feedbacks'
						? control.layeredStyleSelectedElementIds()
						: null
				)
				if (!newEntity) return null

				const added = control.entities.entityAdd(entityLocation, ownerId, newEntity)
				if (!added) return null

				return newEntity.id
			}),

		learnOptions: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				await activeLearningStore.runLearnRequest(entityId, async () => {
					await control.entities.entityLearn(entityLocation, entityId).catch((e) => {
						logger.error(`Learn failed: ${e}`)
						throw e
					})
				})
				return true
			}),

		setEnabled: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					enabled: z.boolean(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, enabled } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entityEnabled(entityLocation, entityId, enabled)
			}),

		setHeadline: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					headline: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, headline } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entityHeadline(entityLocation, entityId, headline)
			}),

		remove: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entityRemove(entityLocation, entityId)
			}),

		duplicate: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entityDuplicate(entityLocation, entityId)
			}),

		setOption: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					key: z.string(),
					value: z.any(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, key, value } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entrySetOptions(entityLocation, entityId, key, value)
			}),

		setConnection: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					connectionId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, connectionId } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entitySetConnection(entityLocation, entityId, connectionId)
			}),

		setInverted: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					isInverted: z.boolean(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, isInverted } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entitySetInverted(entityLocation, entityId, isInverted)
			}),

		move: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					moveEntityLocation: zodEntityLocation,
					moveEntityId: z.string(),
					newOwnerId: zodEntityOwner.nullable(),
					newEntityLocation: zodEntityLocation,
					newIndex: z.number(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, moveEntityLocation, moveEntityId, newOwnerId, newEntityLocation, newIndex } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entityMoveTo(moveEntityLocation, moveEntityId, newOwnerId, newEntityLocation, newIndex)
			}),

		replaceStyleOverride: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					override: schemaFeedbackEntityStyleOverride,
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, override } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities || !control.supportsLayeredStyle)
					throw new Error(`Control "${controlId}" does not support entities or layered styles`)

				return control.entities.entityReplaceStyleOverride(entityLocation, entityId, override)
			}),

		removeStyleOverride: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					overrideId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, overrideId } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities || !control.supportsLayeredStyle)
					throw new Error(`Control "${controlId}" does not support entities or layered styles`)

				return control.entities.entityRemoveStyleOverride(entityLocation, entityId, overrideId)
			}),

		setVariableName: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					name: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, name } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entitySetVariableName(entityLocation, entityId, name)
			}),

		setVariableValue: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					value: z.any(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, value } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				if (!control.supportsEntities) throw new Error(`Control "${controlId}" does not support entities`)

				return control.entities.entitySetVariableValue(entityLocation, entityId, value)
			}),

		localVariableValues: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
				})
			)
			.query(({ input }): VariableValues => {
				const control = controlsMap.get(input.controlId)
				if (!control) return {}

				if (!control.supportsEntities) throw new Error(`Control "${input.controlId}" does not support entities`)

				return control.entities.getLocalVariableValues()
			}),
	})
}
