import type EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import z from 'zod'
import {
	CreateCustomFeedbackControlId,
	zodControlIds,
	type CustomFeedbackControlId,
} from '@companion-app/shared/ControlId.js'
import type {
	ClientCustomFeedbackData,
	CustomFeedbacksUpdate,
	CustomFeedbacksUpdateInitOp,
} from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { publicProcedure, router, throttleIterator, toIterable } from '../UI/TRPC.js'
import { getBuildingBlockUses } from './BuildingBlocks/BuildingBlockCallers.js'
import { createBuildingBlockInputsTrpcRouter } from './BuildingBlocks/BuildingBlockInputsTrpcRouter.js'
import type { ControlChangeEvents } from './ControlDependencies.js'
import { moveControlInCollection } from './ControlOrder.js'
import type { ControlStore } from './ControlStore.js'
import { ControlCustomFeedback } from './ControlTypes/CustomFeedback.js'
import type { CustomFeedbackCollections } from './CustomFeedbackCollections.js'
import type { CustomFeedbackInstanceManager } from './CustomFeedbacks/CustomFeedbackInstanceManager.js'
import type { ControlsFactory } from './Factory.js'

/** How often the uses of a custom feedback are sent at most, as many can change at once */
const USAGE_UPDATE_INTERVAL_MS = 100

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

				yield getBuildingBlockUses(controlStore, input.controlId)

				for await (const _change of changes) {
					yield getBuildingBlockUses(controlStore, input.controlId)
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

		inputs: createBuildingBlockInputsTrpcRouter(controlStore, zodControlIds['custom-feedback'], getCustomFeedback),

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					controlId: zodControlIds['custom-feedback'],
					dropIndex: z.number(),
				})
			)
			.mutation(({ input }) => {
				const thisCustomFeedback = getCustomFeedback(input.controlId)
				if (!thisCustomFeedback) return false

				if (!customFeedbackCollections.doesCollectionIdExist(input.collectionId)) return false

				const allCustomFeedbacks = controlStore.controls
					.values()
					.filter((control) => control instanceof ControlCustomFeedback)
					.toArray()
				moveControlInCollection(allCustomFeedbacks, thisCustomFeedback, input.collectionId, input.dropIndex)

				return true
			}),
	})
}
