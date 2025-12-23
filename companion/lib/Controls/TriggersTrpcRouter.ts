import { CreateTriggerControlId } from '@companion-app/shared/ControlId.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import { ControlTrigger } from './ControlTypes/Triggers/Trigger.js'
import type { TriggerCollections } from './TriggerCollections.js'
import type { SomeControl } from './IControlFragments.js'
import type { TriggerEvents } from './TriggerEvents.js'
import { nanoid } from 'nanoid'
import type { ControlChangeEvents, ControlDependencies } from './ControlDependencies.js'
import z from 'zod'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import { validateTriggerControlId } from './Util.js'
import { TriggerExecutionSource } from './ControlTypes/Triggers/TriggerExecutionSource.js'
import type EventEmitter from 'events'
import type {
	ClientTriggerData,
	TriggersUpdate,
	TriggersUpdateInitOp,
} from '@companion-app/shared/Model/TriggerModel.js'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createTriggersTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	triggerCollections: TriggerCollections,
	dbTable: DataStoreTableView<Record<string, SomeControlModel>>,
	controlsMap: Map<string, SomeControl<any>>,
	triggerEvents: TriggerEvents,
	deps: ControlDependencies
) {
	return router({
		collections: triggerCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<TriggersUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'triggerChange', opts.signal)

			const triggers: Record<string, ClientTriggerData> = {}

			for (const [controlId, control] of controlsMap.entries()) {
				if (control instanceof ControlTrigger) {
					triggers[controlId] = control.toTriggerJSON()
				}
			}

			yield {
				type: 'init',
				triggers: triggers,
			} satisfies TriggersUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies TriggersUpdate
			}
		}),

		create: publicProcedure.mutation(() => {
			const controlId = CreateTriggerControlId(nanoid())

			const newControl = new ControlTrigger(deps, triggerEvents, controlId, null, false)
			controlsMap.set(controlId, newControl)

			// Add trigger to the end of the list
			const allTriggers: ControlTrigger[] = []
			for (const control of controlsMap.values()) {
				if (control instanceof ControlTrigger) {
					allTriggers.push(control)
				}
			}
			const maxRank = Math.max(0, ...allTriggers.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank, true)

			// Ensure it is stored to the db
			newControl.commitChange()

			// No collectionId yet so mark as enabled
			newControl.setCollectionEnabled(true)

			return controlId
		}),
		delete: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const { controlId } = input
			if (!validateTriggerControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const control = controlsMap.get(controlId)
			if (control) {
				control.destroy()

				controlsMap.delete(controlId)

				dbTable.delete(controlId)

				return true
			}

			return false
		}),
		clone: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const { controlId } = input
			if (!validateTriggerControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const newControlId = CreateTriggerControlId(nanoid())

			const fromControl = controlsMap.get(controlId)
			if (fromControl && fromControl instanceof ControlTrigger) {
				const controlJson = fromControl.toJSON(true)

				const newControl = new ControlTrigger(deps, triggerEvents, newControlId, controlJson, true)
				controlsMap.set(newControlId, newControl)

				setImmediate(() => {
					// Ensure the trigger is enabled, on a slight debounce
					newControl.setCollectionEnabled(triggerCollections.isCollectionEnabled(newControl.options.collectionId))
				})

				return newControlId
			}

			return false
		}),
		testActions: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const { controlId } = input
			if (!validateTriggerControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const control = controlsMap.get(controlId)
			if (control && control instanceof ControlTrigger) {
				control.executeActions(Date.now(), TriggerExecutionSource.Test)
			}

			return false
		}),
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

				const thisTrigger = controlsMap.get(controlId)
				if (!thisTrigger || !(thisTrigger instanceof ControlTrigger)) return false

				if (!triggerCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the trigger being moved if needed
				if (thisTrigger.options.collectionId !== (collectionId ?? undefined)) {
					thisTrigger.optionsSetField('collectionId', collectionId ?? undefined, true)
					thisTrigger.setCollectionEnabled(triggerCollections.isCollectionEnabled(collectionId))
				}

				// find all the other triggers with the matching collectionId
				const sortedTriggers = controlsMap
					.values()
					.filter(
						(control): control is ControlTrigger =>
							control.controlId !== controlId &&
							control instanceof ControlTrigger &&
							((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
					)
					.toArray()
					.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

				if (dropIndex < 0) {
					// Push the trigger to the end of the array
					sortedTriggers.push(thisTrigger)
				} else {
					// Insert the trigger at the drop index
					sortedTriggers.splice(dropIndex, 0, thisTrigger)
				}

				// update the sort order of the connections in the store, tracking which ones changed
				sortedTriggers.forEach((trigger, index) => {
					if (trigger.options.sortOrder === index) return // No change

					trigger.optionsSetField('sortOrder', index, true)
				})

				return true
			}),
	})
}
