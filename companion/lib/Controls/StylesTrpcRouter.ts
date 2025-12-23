import z from 'zod'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'
import { ButtonGraphicsElementUsage } from '@companion-app/shared/Model/StyleModel.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createStylesTrpcRouter(controlsMap: Map<string, SomeControl<any>>) {
	return router({
		addElement: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					type: z.string(),
					index: z.number().nullable(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (!control.supportsLayeredStyle) throw new Error(`Control "${input.controlId}" does not support layer styles`)

				return control.layeredStyleAddElement(input.type, input.index)
			}),

		removeElement: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					elementId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (!control.supportsLayeredStyle) throw new Error(`Control "${input.controlId}" does not support layer styles`)

				return control.layeredStyleRemoveElement(input.elementId)
			}),

		moveElement: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					elementId: z.string(),
					parentElementId: z.string().nullable(),
					newIndex: z.number(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (!control.supportsLayeredStyle) throw new Error(`Control "${input.controlId}" does not support layer styles`)

				return control.layeredStyleMoveElement(input.elementId, input.parentElementId, input.newIndex)
			}),

		setElementName: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					elementId: z.string(),
					name: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (!control.supportsLayeredStyle) throw new Error(`Control "${input.controlId}" does not support layer styles`)

				return control.layeredStyleSetElementName(input.elementId, input.name)
			}),

		setElementUsage: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					elementId: z.string(),
					usage: z.nativeEnum(ButtonGraphicsElementUsage),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (!control.supportsLayeredStyle) throw new Error(`Control "${input.controlId}" does not support layer styles`)

				return control.layeredStyleSetElementUsage(input.elementId, input.usage)
			}),

		updateOptionValue: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					elementId: z.string(),
					key: z.string(),
					value: z.any(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (!control.supportsLayeredStyle) throw new Error(`Control "${input.controlId}" does not support layer styles`)

				return control.layeredStyleUpdateOptionValue(input.elementId, input.key, input.value)
			}),

		updateOptionIsExpression: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					elementId: z.string(),
					key: z.string(),
					value: z.boolean(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (!control.supportsLayeredStyle) throw new Error(`Control "${input.controlId}" does not support layer styles`)

				return control.layeredStyleUpdateOptionIsExpression(input.elementId, input.key, input.value)
			}),
	})
}
