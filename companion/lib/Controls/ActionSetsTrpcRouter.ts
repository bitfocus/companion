import z from 'zod'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { ControlActionSetAndStepsEditor } from './Entities/ControlActionSetAndStepsManager.js'
import type { SomeControl } from './IControlFragments.js'

/**
 * Resolve a control to its editable step/action-set surface, or throw. Narrows the step union on its
 * `isEditable` discriminant - read-only controls (e.g. a preset reference) keep the runtime-only surface and
 * lack the mutators, so this is where the structural step/action-set edits are gated.
 */
function getEditableActionSets(control: SomeControl<any>): ControlActionSetAndStepsEditor {
	if (control.supportsActionSets && control.actionSets.isEditable) return control.actionSets
	throw new Error(`Control "${control.controlId}" does not support this operation`)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createActionSetsTrpcRouter(controlsMap: Map<string, SomeControl<any>>) {
	return router({
		add: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableActionSets(control).actionSetAdd(input.stepId)
			}),

		remove: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
					setId: z.number(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableActionSets(control).actionSetRemove(input.stepId, input.setId)
			}),

		rename: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
					oldSetId: z.number(),
					newSetId: z.number(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableActionSets(control).actionSetRename(input.stepId, input.oldSetId, input.newSetId)
			}),

		setRunWhileHeld: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
					setId: z.number(),
					runWhileHeld: z.boolean(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableActionSets(control).actionSetRunWhileHeld(input.stepId, input.setId, input.runWhileHeld)
			}),
	})
}
