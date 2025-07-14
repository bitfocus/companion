import z from 'zod'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'

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

				if (control.supportsActionSets) {
					return control.actionSets.actionSetAdd(input.stepId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support this operation`)
				}
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

				if (control.supportsActionSets) {
					return control.actionSets.actionSetRemove(input.stepId, input.setId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support this operation`)
				}
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

				if (control.supportsActionSets) {
					return control.actionSets.actionSetRename(input.stepId, input.oldSetId, input.newSetId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support this operation`)
				}
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

				if (control.supportsActionSets) {
					return control.actionSets.actionSetRunWhileHeld(input.stepId, input.setId, input.runWhileHeld)
				} else {
					throw new Error(`Control "${input.controlId}" does not support this operation`)
				}
			}),
	})
}
