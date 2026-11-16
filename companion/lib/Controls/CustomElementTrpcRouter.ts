import type EventEmitter from 'node:events'
import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import z from 'zod'
import {
	CreateCustomElementControlId,
	zodControlIds,
	type CustomElementControlId,
} from '@companion-app/shared/ControlId.js'
import type {
	ClientCustomElementData,
	CustomElementsUpdate,
	CustomElementsUpdateInitOp,
	CustomElementUse,
} from '@companion-app/shared/Model/CustomElementModel.js'
import { mergeEventTriggers, publicProcedure, router, throttleIterator, toIterable } from '../UI/TRPC.js'
import type { ControlChangeEvents, ControlCommonEvents } from './ControlDependencies.js'
import { moveControlInCollection } from './ControlOrder.js'
import type { ControlStore } from './ControlStore.js'
import { ControlCustomElement } from './ControlTypes/CustomElement.js'
import type { CustomElementCollections } from './CustomElementCollections.js'
import { getCustomElementUses } from './CustomElements/CustomElementUses.js'
import type { ControlsFactory } from './Factory.js'

/** How often the uses of a custom element are sent at most, as many can change at once */
const USAGE_UPDATE_INTERVAL_MS = 100

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomElementTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	controlEvents: EventEmitter<ControlCommonEvents>,
	customElementCollections: CustomElementCollections,
	controlStore: ControlStore,
	factory: ControlsFactory
) {
	function getCustomElement(controlId: CustomElementControlId): ControlCustomElement | undefined {
		const control = controlStore.controls.get(controlId)
		return control instanceof ControlCustomElement ? control : undefined
	}

	return router({
		collections: customElementCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<CustomElementsUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'customElementChange', opts.signal)

			const customElements: Record<CustomElementControlId, ClientCustomElementData> = {}

			for (const control of controlStore.controls.values()) {
				if (control instanceof ControlCustomElement) {
					customElements[control.controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', customElements } satisfies CustomElementsUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies CustomElementsUpdate
			}
		}),

		watchUses: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-element'] }))
			.subscription(async function* ({ input, signal }) {
				// Aborted here too, so that the listeners are removed however the subscription ends
				const abort = new AbortController()
				const subscriptionSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal

				try {
					// An element of any control can be changed to use it, or stop using it, and a control can be removed
					const changes = throttleIterator(
						mergeEventTriggers(subscriptionSignal, [
							{ ee: controlEvents, key: 'layeredStyleElementChanged' },
							{ ee: controlEvents, key: 'controlCountChanged' },
							{ ee: changeEvents, key: 'customElementChange' },
						]),
						USAGE_UPDATE_INTERVAL_MS
					)

					let lastUses: CustomElementUse[] = getCustomElementUses(controlStore, input.controlId)
					yield lastUses

					for await (const _change of changes) {
						const uses = getCustomElementUses(controlStore, input.controlId)
						if (isEqual(uses, lastUses)) continue

						lastUses = uses
						yield uses
					}
				} finally {
					abort.abort()
				}
			}),

		create: publicProcedure.input(z.object({ name: z.string() })).mutation(({ input }) => {
			const controlId = CreateCustomElementControlId(nanoid())
			const newControl = factory.createCustomElement(controlId)

			controlStore.controls.set(controlId, newControl)

			// Add to the end of the list
			const allCustomElements: ControlCustomElement[] = []
			for (const control of controlStore.controls.values()) {
				if (control instanceof ControlCustomElement) {
					allCustomElements.push(control)
				}
			}
			const maxRank = Math.max(0, ...allCustomElements.map((control) => control.options.sortOrder))
			newControl.optionsSetField({ key: 'sortOrder', value: maxRank + 1 }, true)

			newControl.optionsSetField({ key: 'name', value: input.name })

			newControl.start(true)

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: zodControlIds['custom-element'] })).mutation(({ input }) => {
			const control = getCustomElement(input.controlId)
			if (!control) return false

			control.destroy()
			controlStore.deleteControl(input.controlId)

			return true
		}),

		clone: publicProcedure.input(z.object({ controlId: zodControlIds['custom-element'] })).mutation(({ input }) => {
			const fromControl = getCustomElement(input.controlId)
			if (!fromControl) return false

			const newControlId = CreateCustomElementControlId(nanoid())

			const controlJson = structuredClone(fromControl.toJSON())
			controlJson.options.name = `${controlJson.options.name} (copy)`

			const newControl = factory.createCustomElement(newControlId, controlJson)
			controlStore.controls.set(newControlId, newControl)
			newControl.start(true)

			return newControlId
		}),

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					controlId: zodControlIds['custom-element'],
					dropIndex: z.number(),
				})
			)
			.mutation(({ input }) => {
				const thisCustomElement = getCustomElement(input.controlId)
				if (!thisCustomElement) return false

				if (!customElementCollections.doesCollectionIdExist(input.collectionId)) return false

				const allCustomElements = controlStore.controls
					.values()
					.filter((control) => control instanceof ControlCustomElement)
					.toArray()
				moveControlInCollection(allCustomElements, thisCustomElement, input.collectionId, input.dropIndex)

				return true
			}),
	})
}
