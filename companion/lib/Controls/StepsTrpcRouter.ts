import z from 'zod'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { ControlActionSetAndStepsEditor } from './Entities/ControlActionSetAndStepsManager.js'
import type { SomeControl } from './IControlFragments.js'

/**
 * Resolve a control to its editable step surface, or throw. Narrows the step union on its `isEditable`
 * discriminant; read-only controls keep only the runtime navigation surface, gating the structural step edits.
 */
function getEditableSteps(control: SomeControl<any>): ControlActionSetAndStepsEditor {
	if (control.supportsActionSets && control.actionSets.isEditable) return control.actionSets
	throw new Error(`Control "${control.controlId}" does not support steps`)
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createStepsTrpcRouter(controlsMap: Map<string, SomeControl<any>>) {
	return router({
		add: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableSteps(control).stepAdd()
			}),

		duplicate: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableSteps(control).stepDuplicate(input.stepId)
			}),

		remove: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableSteps(control).stepRemove(input.stepId)
			}),

		swap: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId1: z.string(),
					stepId2: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableSteps(control).stepSwap(input.stepId1, input.stepId2)
			}),

		setCurrent: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				// Runtime navigation - allowed on read-only controls too, so it uses the runtime actionSets surface
				if (control.supportsActionSets) {
					return control.actionSets.stepSelectCurrent(input.stepId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support steps`)
				}
			}),

		rename: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					stepId: z.string(),
					newName: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				return getEditableSteps(control).stepRename(input.stepId, input.newName)
			}),
	})
}
