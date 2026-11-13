import type EventEmitter from 'node:events'
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
} from '@companion-app/shared/Model/CustomPresetModel.js'
import type { IPageStore } from '../Page/Store.js'
import { zodLocation } from '../Preview/Graphics.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { ControlChangeEvents } from './ControlDependencies.js'
import type { ControlStore } from './ControlStore.js'
import { ControlButtonLayered } from './ControlTypes/Button/Layered.js'
import { ControlCustomPreset } from './ControlTypes/CustomPreset.js'
import type { CustomPresetCollections } from './CustomPresetCollections.js'
import type { ControlsFactory } from './Factory.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomPresetTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
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
				const { collectionId, controlId, dropIndex } = input

				const thisCustomPreset = getCustomPreset(controlId)
				if (!thisCustomPreset) return false

				if (!customPresetCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the custom preset being moved if needed
				if (thisCustomPreset.options.collectionId !== (collectionId ?? undefined)) {
					thisCustomPreset.optionsSetField({ key: 'collectionId', value: collectionId ?? undefined }, true)
				}

				// find all the other custom presets with the matching collectionId
				const sortedCustomPresets = controlStore.controls
					.values()
					.filter(
						(control): control is ControlCustomPreset =>
							control instanceof ControlCustomPreset &&
							control.controlId !== controlId &&
							((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
					)
					.toArray()
					.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

				if (dropIndex < 0) {
					// Push the custom preset to the end of the array
					sortedCustomPresets.push(thisCustomPreset)
				} else {
					// Insert the custom preset at the drop index
					sortedCustomPresets.splice(dropIndex, 0, thisCustomPreset)
				}

				// update the sort order of the custom presets in the store
				sortedCustomPresets.forEach((customPreset, index) => {
					if (customPreset.options.sortOrder === index) return // No change

					customPreset.optionsSetField({ key: 'sortOrder', value: index }, true)
				})

				return true
			}),
	})
}
