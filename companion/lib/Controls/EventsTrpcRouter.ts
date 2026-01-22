import z from 'zod'
import { publicProcedure, router } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'
import type { InstanceDefinitions } from '../Instance/Definitions.js'
import { JsonValueSchema } from '@companion-app/shared/Model/Options.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createEventsTrpcRouter(
	controlsMap: Map<string, SomeControl<any>>,
	instanceDefinitions: InstanceDefinitions
) {
	return router({
		add: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					eventType: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsEvents) {
					const eventItem = instanceDefinitions.createEventItem(input.eventType)
					if (eventItem) {
						return control.eventAdd(eventItem)
					} else {
						return false
					}
				} else {
					throw new Error(`Control "${input.controlId}" does not support events`)
				}
			}),

		setEnabled: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					eventId: z.string(),
					enabled: z.boolean(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventEnabled(input.eventId, input.enabled)
				} else {
					throw new Error(`Control "${input.controlId}" does not support events`)
				}
			}),

		setHeadline: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					eventId: z.string(),
					headline: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventHeadline(input.eventId, input.headline)
				} else {
					throw new Error(`Control "${input.controlId}" does not support events`)
				}
			}),
		remove: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					eventId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventRemove(input.eventId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support events`)
				}
			}),

		duplicate: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					eventId: z.string(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventDuplicate(input.eventId)
				} else {
					throw new Error(`Control "${input.controlId}" does not support events`)
				}
			}),

		setOption: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					eventId: z.string(),
					key: z.string(),
					value: JsonValueSchema.optional(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventSetOptions(input.eventId, input.key, input.value)
				} else {
					throw new Error(`Control "${input.controlId}" does not support events`)
				}
			}),

		reorder: publicProcedure
			.input(
				z.object({
					controlId: z.string(),
					oldIndex: z.number(),
					newIndex: z.number(),
				})
			)
			.mutation(async ({ input }) => {
				const control = controlsMap.get(input.controlId)
				if (!control) return false

				if (control.supportsEvents) {
					return control.eventReorder(input.oldIndex, input.newIndex)
				} else {
					throw new Error(`Control "${input.controlId}" does not support events`)
				}
			}),
	})
}
