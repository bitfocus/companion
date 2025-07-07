import z from 'zod'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'

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

				if (control.supportsActionSets) {
					return control.actionSets.stepAdd()
				} else {
					throw new Error(`Control "${input.controlId}" does not support steps`)
				}
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

				if (control.supportsActionSets) {
					return control.actionSets.stepDuplicate(input.stepId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support steps`)
				}
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

				if (control.supportsActionSets) {
					return control.actionSets.stepRemove(input.stepId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support steps`)
				}
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

				if (control.supportsActionSets) {
					return control.actionSets.stepSwap(input.stepId1, input.stepId2)
				} else {
					throw new Error(`Control "${input.controlId}" does not support steps`)
				}
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

				if (control.supportsActionSets) {
					return control.actionSets.stepRename(input.stepId, input.newName)
				} else {
					throw new Error(`Control "${input.controlId}" does not support steps`)
				}
			}),
	})
}
