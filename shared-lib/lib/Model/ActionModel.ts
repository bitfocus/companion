import z from 'zod'
import { SomeEntityModelSchema, type SomeEntityModel } from './EntityModel.js'

export const ActionStepOptionsSchema = z.object({
	runWhileHeld: z.array(z.number()).default(() => []),
	name: z.string().optional(),
})

export type ActionStepOptions = z.output<typeof ActionStepOptionsSchema>

export type ActionSetId = 'down' | 'up' | 'rotate_left' | 'rotate_right' | number
export type ActionSetsModel = Record<ActionSetId, SomeEntityModel[] | undefined>

const actionSetEntitiesSchema = z.array(SomeEntityModelSchema)

/**
 * The press and release sets, those of rotation if it is enabled, and one for each hold duration, keyed by its
 * milliseconds. The keys mix names and numbers, so the type is written by hand
 */
export const ActionSetsModelSchema: z.ZodType<ActionSetsModel> = z
	.object({
		down: actionSetEntitiesSchema.default(() => []),
		up: actionSetEntitiesSchema.default(() => []),
		// Stored without them when rotation is disabled; the transform makes the keys present, as the type requires
		rotate_left: actionSetEntitiesSchema.optional().transform((set) => set),
		rotate_right: actionSetEntitiesSchema.optional().transform((set) => set),
	})
	.catchall(actionSetEntitiesSchema.optional())
