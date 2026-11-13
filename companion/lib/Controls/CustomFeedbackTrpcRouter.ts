import type EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import z from 'zod'
import { isCustomFeedbacksConnectionId } from '@companion-app/shared/ConnectionId.js'
import {
	CreateCustomFeedbackControlId,
	ParseControlId,
	zodControlIds,
	type CustomFeedbackControlId,
} from '@companion-app/shared/ControlId.js'
import type {
	ClientCustomFeedbackData,
	CustomFeedbacksUpdate,
	CustomFeedbacksUpdateInitOp,
	CustomFeedbackUse,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { AuthorableInputFieldSchema } from '@companion-app/shared/Model/Options.js'
import { publicProcedure, router, throttleIterator, toIterable } from '../UI/TRPC.js'
import type { ControlChangeEvents } from './ControlDependencies.js'
import type { ControlStore } from './ControlStore.js'
import { ControlCustomFeedback } from './ControlTypes/CustomFeedback.js'
import type { CustomFeedbackCollections } from './CustomFeedbackCollections.js'
import {
	removeCustomFeedbackInputInCallers,
	renameCustomFeedbackInputInCallers,
} from './CustomFeedbacks/CustomFeedbackCallers.js'
import type { CustomFeedbackInstanceManager } from './CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlsFactory } from './Factory.js'

/** How often the uses of a custom feedback are sent at most, as many can change at once */
const USAGE_UPDATE_INTERVAL_MS = 100

/**
 * What uses a custom feedback
 * @param controlStore The store of all the controls
 * @param customFeedbackControlId The control id of the custom feedback
 */
function getCustomFeedbackUses(
	controlStore: ControlStore,
	customFeedbackControlId: CustomFeedbackControlId
): CustomFeedbackUse[] {
	const parsedId = ParseControlId(customFeedbackControlId)
	if (parsedId?.type !== 'custom-feedback') return []

	const uses: CustomFeedbackUse[] = []
	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		for (const entity of control.entities.getAllEntities()) {
			if (!isCustomFeedbacksConnectionId(entity.connectionId) || entity.definitionId !== parsedId.customFeedbackId)
				continue

			uses.push({ controlId: control.controlId, entityId: entity.id, disabled: !!entity.disabled })
		}
	}

	return uses
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomFeedbackTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	customFeedbackCollections: CustomFeedbackCollections,
	controlStore: ControlStore,
	factory: ControlsFactory,
	customFeedbackInstances: CustomFeedbackInstanceManager
) {
	function getCustomFeedback(controlId: CustomFeedbackControlId): ControlCustomFeedback | undefined {
		const control = controlStore.controls.get(controlId)
		return control instanceof ControlCustomFeedback ? control : undefined
	}

	return router({
		collections: customFeedbackCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<CustomFeedbacksUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'customFeedbackChange', opts.signal)

			const customFeedbacks: Record<CustomFeedbackControlId, ClientCustomFeedbackData> = {}

			for (const control of controlStore.controls.values()) {
				if (control instanceof ControlCustomFeedback) {
					customFeedbacks[control.controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', customFeedbacks } satisfies CustomFeedbacksUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies CustomFeedbacksUpdate
			}
		}),

		watchUses: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-feedback'] }))
			.subscription(async function* ({ input, signal }) {
				const changes = throttleIterator(
					toIterable(customFeedbackInstances.events, 'usageChanged', signal),
					USAGE_UPDATE_INTERVAL_MS
				)

				yield getCustomFeedbackUses(controlStore, input.controlId)

				for await (const _change of changes) {
					yield getCustomFeedbackUses(controlStore, input.controlId)
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
			newControl.optionsSetField({ key: 'sortOrder', value: maxRank + 1 }, true)

			newControl.optionsSetField({ key: 'name', value: input.name })

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: zodControlIds['custom-feedback'] })).mutation(({ input }) => {
			const control = getCustomFeedback(input.controlId)
			if (!control) return false

			control.destroy()
			controlStore.deleteControl(input.controlId)

			return true
		}),

		clone: publicProcedure.input(z.object({ controlId: zodControlIds['custom-feedback'] })).mutation(({ input }) => {
			const fromControl = getCustomFeedback(input.controlId)
			if (!fromControl) return false

			const newControlId = CreateCustomFeedbackControlId(nanoid())

			const controlJson = structuredClone(fromControl.toJSON())
			controlJson.options.name = `${controlJson.options.name} (copy)`

			const newControl = factory.createCustomFeedback(newControlId, controlJson)
			controlStore.controls.set(newControlId, newControl)

			return newControlId
		}),

		inputAdd: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-feedback'], field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const control = getCustomFeedback(input.controlId)
				if (!control) return false

				return control.inputAdd(input.field)
			}),

		inputRemove: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-feedback'], inputId: z.string() }))
			.mutation(({ input }) => {
				const control = getCustomFeedback(input.controlId)
				if (!control) return false

				if (!control.inputRemove(input.inputId)) return false

				removeCustomFeedbackInputInCallers(controlStore, input.controlId, input.inputId)

				return true
			}),

		inputMove: publicProcedure
			.input(
				z.object({ controlId: zodControlIds['custom-feedback'], inputId: z.string(), index: z.number().int().min(0) })
			)
			.mutation(({ input }) => {
				const control = getCustomFeedback(input.controlId)
				if (!control) return false

				return control.inputMove(input.inputId, input.index)
			}),

		inputUpdate: publicProcedure
			.input(
				z.object({
					controlId: zodControlIds['custom-feedback'],
					inputId: z.string(),
					field: AuthorableInputFieldSchema,
				})
			)
			.mutation(({ input }) => {
				const control = getCustomFeedback(input.controlId)
				if (!control) return false

				if (!control.inputUpdate(input.inputId, input.field)) return false

				// Make sure the feedbacks using the custom feedback keep their value for a renamed input
				if (input.field.id !== input.inputId) {
					renameCustomFeedbackInputInCallers(controlStore, input.controlId, input.inputId, input.field.id)
				}

				return true
			}),

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					controlId: zodControlIds['custom-feedback'],
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
					thisCustomFeedback.optionsSetField({ key: 'collectionId', value: collectionId ?? undefined }, true)
				}

				// find all the other custom feedbacks with the matching collectionId
				const sortedCustomFeedbacks = controlStore.controls
					.values()
					.filter(
						(control): control is ControlCustomFeedback =>
							control instanceof ControlCustomFeedback &&
							control.controlId !== controlId &&
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

					customFeedback.optionsSetField({ key: 'sortOrder', value: index }, true)
				})

				return true
			}),
	})
}
