import z from 'zod'
import {
	EntityModelType,
	schemaFeedbackEntityStyleOverride,
	zodEntityLocation,
	zodRawStoreResult,
	type EntityOwner,
} from '@companion-app/shared/Model/EntityModel.js'
import {
	createExpressionOrValueSchema,
	ExpressionOrJsonValueSchema,
	JsonValueSchema,
} from '@companion-app/shared/Model/Options.js'
import type { VariableValues } from '@companion-app/shared/Model/Variables.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import LogController from '../Log/Controller.js'
import type { ActiveLearningStore } from '../Resources/ActiveLearningStore.js'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { EditableEntityListPool } from './Entities/EntityListPoolEditingMixin.js'
import type { SomeControl } from './IControlFragments.js'

const zodEntityOwner: z.ZodSchema<EntityOwner> = z.object({
	parentId: z.string(),
	childGroup: z.string(),
})

/**
 * Resolve a control to its editable entity pool, or throw if the control has no entities or is read-only.
 * Narrows the pool union on its `isEditable` discriminant - on a read-only control (e.g. a preset reference)
 * the pool is the read-only type and genuinely lacks the mutators, so this is where the edits are gated.
 */
function getEditableEntities(control: SomeControl<any>): EditableEntityListPool {
	if (control.supportsEntities && control.entities.isEditable) return control.entities
	throw new Error(`Control "${control.controlId}" does not support editing entities`)
}

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

				const newEntity = instanceDefinitions.createEntityItem(
					connectionId,
					entityType,
					entityDefinition,
					control.supportsLayeredStyle && entityLocation === 'feedbacks'
						? control.layeredStyleSelectedElementIds()
						: null
				)
				if (!newEntity) return null

				const added = getEditableEntities(control).entityAdd(entityLocation, ownerId, newEntity)
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

				const editable = getEditableEntities(control)
				await activeLearningStore.runLearnRequest(entityId, async () => {
					await editable.entityLearn(entityLocation, entityId).catch((e) => {
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

				return getEditableEntities(control).entityEnabled(entityLocation, entityId, enabled)
			}),

		setRawStoreResult: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					target:
						// tRPC's transport drops `undefined` fields during serialization
						// because they're not JSON-compatible.  Use `.optional()` rather
						// than including `z.undefined()` directly in the union to permit
						// true absence.
						zodRawStoreResult.optional(),
				})
			)
			.mutation(async ({ input: { controlId, entityLocation, entityId, target } }) => {
				const control = controlsMap.get(controlId)
				if (!control) return false

				return getEditableEntities(control).entitySetRawStoreResult(entityLocation, entityId, target)
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

				return getEditableEntities(control).entityHeadline(entityLocation, entityId, headline)
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

				return getEditableEntities(control).entityRemove(entityLocation, entityId)
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

				return getEditableEntities(control).entityDuplicate(entityLocation, entityId)
			}),

		setOption: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					key: z.string(),
					value: ExpressionOrJsonValueSchema,
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, key, value } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				return getEditableEntities(control).entitySetOption(entityLocation, entityId, key, value)
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

				return getEditableEntities(control).entitySetConnection(entityLocation, entityId, connectionId)
			}),

		setInverted: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					isInverted: createExpressionOrValueSchema(z.boolean()),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, isInverted } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				return getEditableEntities(control).entitySetInverted(entityLocation, entityId, isInverted)
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

				return getEditableEntities(control).entityMoveTo(
					moveEntityLocation,
					moveEntityId,
					newOwnerId,
					newEntityLocation,
					newIndex
				)
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

				if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layered styles`)

				return getEditableEntities(control).entityReplaceStyleOverride(entityLocation, entityId, override)
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

				if (!control.supportsLayeredStyle) throw new Error(`Control "${controlId}" does not support layered styles`)

				return getEditableEntities(control).entityRemoveStyleOverride(entityLocation, entityId, overrideId)
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

				return getEditableEntities(control).entitySetVariableName(entityLocation, entityId, name)
			}),

		setVariableValue: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					entityLocation: zodEntityLocation,
					entityId: z.string(),
					value: JsonValueSchema.optional(),
				})
			)
			.mutation(async ({ input }) => {
				const { controlId, entityLocation, entityId, value } = input

				const control = controlsMap.get(controlId)
				if (!control) return false

				return getEditableEntities(control).entitySetVariableValue(entityLocation, entityId, value)
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
