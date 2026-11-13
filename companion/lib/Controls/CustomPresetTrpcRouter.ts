import type EventEmitter from 'node:events'
import isEqual from 'fast-deep-equal'
import { nanoid } from 'nanoid'
import z from 'zod'
import {
	CreateCustomPresetControlId,
	zodControlIds,
	type CustomPresetControlId,
} from '@companion-app/shared/ControlId.js'
import type {
	ClientCustomPresetData,
	CustomPresetModel,
	CustomPresetsUpdate,
	CustomPresetsUpdateInitOp,
	CustomPresetUse,
} from '@companion-app/shared/Model/CustomPresetModel.js'
import type { IPageStore } from '../Page/Store.js'
import { zodLocation } from '../Preview/Graphics.js'
import { mergeEventTriggers, publicProcedure, router, throttleIterator, toIterable } from '../UI/TRPC.js'
import type { ControlChangeEvents, ControlCommonEvents } from './ControlDependencies.js'
import { moveControlInCollection } from './ControlOrder.js'
import type { ControlStore } from './ControlStore.js'
import { ControlButtonLayered } from './ControlTypes/Button/Layered.js'
import { ControlCustomPreset } from './ControlTypes/CustomPreset.js'
import type { CustomPresetCollections } from './CustomPresetCollections.js'
import { getCustomPresetUses } from './CustomPresets/CustomPresetUses.js'
import type { ControlsFactory } from './Factory.js'

/** How often the uses of a custom preset are sent at most, as many can change at once */
const USAGE_UPDATE_INTERVAL_MS = 100

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomPresetTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	controlEvents: EventEmitter<ControlCommonEvents>,
	customPresetCollections: CustomPresetCollections,
	controlStore: ControlStore,
	factory: ControlsFactory,
	pageStore: IPageStore
) {
	function getCustomPreset(controlId: CustomPresetControlId): ControlCustomPreset | undefined {
		const control = controlStore.controls.get(controlId)
		return control instanceof ControlCustomPreset ? control : undefined
	}

	/** The sortOrder which puts a new custom preset at the end of the list */
	function getNextSortOrder(): number {
		let maxRank = 0
		for (const control of controlStore.controls.values()) {
			if (control instanceof ControlCustomPreset) maxRank = Math.max(maxRank, control.options.sortOrder)
		}
		return maxRank + 1
	}

	/** Add a custom preset, made from the stored model, or a new button when there is none */
	function addCustomPreset(name: string, storage: CustomPresetModel | null): CustomPresetControlId {
		const controlId = CreateCustomPresetControlId(nanoid())
		const newControl = factory.createCustomPreset(controlId, storage)

		controlStore.controls.set(controlId, newControl)

		newControl.optionsSetField({ key: 'sortOrder', value: getNextSortOrder() }, true)
		newControl.optionsSetField({ key: 'name', value: name })

		newControl.start(true)

		return controlId
	}

	return router({
		collections: customPresetCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<CustomPresetsUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'customPresetChange', opts.signal)

			const customPresets: Record<CustomPresetControlId, ClientCustomPresetData> = {}

			for (const control of controlStore.controls.values()) {
				if (control instanceof ControlCustomPreset) {
					customPresets[control.controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', customPresets } satisfies CustomPresetsUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies CustomPresetsUpdate
			}
		}),

		watchUses: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-preset'] }))
			.subscription(async function* ({ input, signal }) {
				// Aborted here too, so that the listeners are removed however the subscription ends
				const abort = new AbortController()
				const subscriptionSignal = signal ? AbortSignal.any([signal, abort.signal]) : abort.signal

				try {
					// A linked button is placed, and removed or unlinked, by replacing the control at a location
					const changes = throttleIterator(
						mergeEventTriggers(subscriptionSignal, [
							{ ee: controlEvents, key: 'controlPlacedAt' },
							{ ee: controlEvents, key: 'controlCountChanged' },
						]),
						USAGE_UPDATE_INTERVAL_MS
					)

					let lastUses: CustomPresetUse[] = getCustomPresetUses(controlStore, input.controlId)
					yield lastUses

					for await (const _change of changes) {
						const uses = getCustomPresetUses(controlStore, input.controlId)
						if (isEqual(uses, lastUses)) continue

						lastUses = uses
						yield uses
					}
				} finally {
					abort.abort()
				}
			}),

		create: publicProcedure.input(z.object({ name: z.string() })).mutation(({ input }) => {
			return addCustomPreset(input.name, null)
		}),

		/** Make a custom preset from a copy of a button on the grid */
		createFromButton: publicProcedure
			.input(z.object({ location: zodLocation, name: z.string() }))
			.mutation(({ input }) => {
				const controlId = pageStore.getControlIdAt(input.location)
				if (!controlId) return null

				const control = controlStore.controls.get(controlId)
				if (!(control instanceof ControlButtonLayered)) return null

				const button = structuredClone(control.toJSON())
				return addCustomPreset(input.name, {
					...button,
					type: 'custom-preset',
					options: {
						...button.options,
						name: input.name,
						description: '',
						sortOrder: 0,
						collectionId: undefined,
					},
				})
			}),

		delete: publicProcedure.input(z.object({ controlId: zodControlIds['custom-preset'] })).mutation(({ input }) => {
			const control = getCustomPreset(input.controlId)
			if (!control) return false

			control.destroy()
			controlStore.deleteControl(input.controlId)

			return true
		}),

		clone: publicProcedure.input(z.object({ controlId: zodControlIds['custom-preset'] })).mutation(({ input }) => {
			const fromControl = getCustomPreset(input.controlId)
			if (!fromControl) return false

			const newControlId = CreateCustomPresetControlId(nanoid())

			const controlJson = structuredClone(fromControl.toJSON())
			controlJson.options.name = `${controlJson.options.name} (copy)`

			const newControl = factory.createCustomPreset(newControlId, controlJson)
			controlStore.controls.set(newControlId, newControl)
			newControl.start(true)

			return newControlId
		}),

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					controlId: zodControlIds['custom-preset'],
					dropIndex: z.number(),
				})
			)
			.mutation(({ input }) => {
				const thisCustomPreset = getCustomPreset(input.controlId)
				if (!thisCustomPreset) return false

				if (!customPresetCollections.doesCollectionIdExist(input.collectionId)) return false

				const allCustomPresets = controlStore.controls
					.values()
					.filter((control) => control instanceof ControlCustomPreset)
					.toArray()
				moveControlInCollection(allCustomPresets, thisCustomPreset, input.collectionId, input.dropIndex)

				return true
			}),
	})
}
