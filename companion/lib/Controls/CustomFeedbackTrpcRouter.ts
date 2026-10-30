import type EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import z from 'zod'
import { CreateCustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import {
	getCustomFeedbackCallDefinition,
	type ClientCustomFeedbackData,
	type CustomFeedbacksUpdate,
	type CustomFeedbacksUpdateInitOp,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { ControlChangeEvents } from './ControlDependencies.js'
import type { ControlStore } from './ControlStore.js'
import { ControlCustomFeedback } from './ControlTypes/CustomFeedback.js'
import { createCustomEntityInputsProcedures } from './CustomEntities/CustomEntityTrpc.js'
import type { CustomFeedbackCollections } from './CustomFeedbackCollections.js'
import type { ControlsFactory } from './Factory.js'
import { validateCustomFeedbackControlId } from './Util.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomFeedbackTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	customFeedbackCollections: CustomFeedbackCollections,
	controlStore: ControlStore,
	factory: ControlsFactory
) {
	function getCustomFeedback(controlId: string): ControlCustomFeedback | undefined {
		if (!validateCustomFeedbackControlId(controlId)) return undefined

		const control = controlStore.controls.get(controlId)
		return control instanceof ControlCustomFeedback ? control : undefined
	}

	return router({
		collections: customFeedbackCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<CustomFeedbacksUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'customFeedbackChange', opts.signal)

			const customFeedbacks: Record<string, ClientCustomFeedbackData> = {}

			for (const [controlId, control] of controlStore.controls.entries()) {
				if (control instanceof ControlCustomFeedback) {
					customFeedbacks[controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', customFeedbacks } satisfies CustomFeedbacksUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies CustomFeedbacksUpdate
			}
		}),

		create: publicProcedure.input(z.object({ name: z.string() })).mutation(({ input }) => {
			const controlId = CreateCustomFeedbackControlId(nanoid())
			const newControl = factory.createCustomFeedback(controlId)

			controlStore.controls.set(controlId, newControl)

			// Add to the end of the list
			const allCustomFeedbacks: ControlCustomFeedback[] = []
			for (const control of controlStore.controls.values()) {
				if (control instanceof ControlCustomFeedback) {
					allCustomFeedbacks.push(control)
				}
			}
			const maxRank = Math.max(0, ...allCustomFeedbacks.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank + 1, true)

			newControl.optionsSetField('name', input.name)

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const control = getCustomFeedback(input.controlId)
			if (!control) return false

			control.destroy()
			controlStore.deleteControl(input.controlId)

			return true
		}),

		clone: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const fromControl = getCustomFeedback(input.controlId)
			if (!fromControl) return false

			const newControlId = CreateCustomFeedbackControlId(nanoid())

			const controlJson = fromControl.toJSON(true)
			controlJson.options.name = `${controlJson.options.name} (copy)`

			const newControl = factory.createCustomFeedback(newControlId, controlJson)
			controlStore.controls.set(newControlId, newControl)

			return newControlId
		}),

		...createCustomEntityInputsProcedures(controlStore, getCustomFeedback, getCustomFeedbackCallDefinition),

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					controlId: z.string(),
					dropIndex: z.number(),
				})
			)
			.mutation(({ input }) => {
				const { collectionId, controlId, dropIndex } = input

				const thisCustomFeedback = getCustomFeedback(controlId)
				if (!thisCustomFeedback) return false

				if (!customFeedbackCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the custom feedback being moved if needed
				if (thisCustomFeedback.options.collectionId !== (collectionId ?? undefined)) {
					thisCustomFeedback.optionsSetField('collectionId', collectionId ?? undefined, true)
				}

				// find all the other custom feedbacks with the matching collectionId
				const sortedCustomFeedbacks = controlStore.controls
					.values()
					.filter(
						(control): control is ControlCustomFeedback =>
							control.controlId !== controlId &&
							control instanceof ControlCustomFeedback &&
							((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
					)
					.toArray()
					.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

				if (dropIndex < 0) {
					// Push the custom feedback to the end of the array
					sortedCustomFeedbacks.push(thisCustomFeedback)
				} else {
					// Insert the custom feedback at the drop index
					sortedCustomFeedbacks.splice(dropIndex, 0, thisCustomFeedback)
				}

				// update the sort order of the custom feedbacks in the store, tracking which ones changed
				sortedCustomFeedbacks.forEach((customFeedback, index) => {
					if (customFeedback.options.sortOrder === index) return // No change

					customFeedback.optionsSetField('sortOrder', index, true)
				})

				return true
			}),
	})
}
