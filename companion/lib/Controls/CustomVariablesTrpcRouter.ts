import { CreateCustomVariableControlId } from '@companion-app/shared/ControlId.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'
import { nanoid } from 'nanoid'
import type { ControlChangeEvents, ControlDependencies } from './ControlDependencies.js'
import z from 'zod'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type EventEmitter from 'events'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type { CustomVariableCollections } from '../Variables/CustomVariableCollections.js'
import { ControlCustomVariable } from './ControlTypes/CustomVariable.js'
import { validateCustomVariableControlId } from './Util.js'
import {
	ClientCustomVariableData,
	CustomVariableUpdate2,
	CustomVariableUpdateInitOp2,
} from '@companion-app/shared/Model/CustomVariableModel.js'
import type { CustomVariableNameMap } from './CustomVariableNameMap.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomVariablesTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	customVariableCollections: CustomVariableCollections,
	dbTable: DataStoreTableView<Record<string, SomeControlModel>>,
	controlsMap: Map<string, SomeControl<any>>,
	customVariableNamesMap: CustomVariableNameMap,
	deps: ControlDependencies
) {
	return router({
		collections: customVariableCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<CustomVariableUpdate2>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'customVariableChange', opts.signal)

			const variables: Record<string, ClientCustomVariableData> = {}

			for (const [controlId, control] of controlsMap.entries()) {
				if (control instanceof ControlCustomVariable) {
					variables[controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', variables } satisfies CustomVariableUpdateInitOp2

			for await (const [_controlId, data] of changes) {
				yield data satisfies CustomVariableUpdate2
			}
		}),

		create: publicProcedure.mutation(() => {
			const controlId = CreateCustomVariableControlId(nanoid())
			const newControl = new ControlCustomVariable(deps, controlId, null, false)
			controlsMap.set(controlId, newControl)

			// Add variable to the end of the list
			const allCustomVariables: ControlCustomVariable[] = []
			for (const control of controlsMap.values()) {
				if (control instanceof ControlCustomVariable) {
					allCustomVariables.push(control)
				}
			}
			const maxRank = Math.max(0, ...allCustomVariables.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank, true)

			// Add to names map (initially empty variableName, will be added when name is set)
			customVariableNamesMap.addCustomVariable(controlId, newControl.options.variableName)

			// Ensure it is stored to the db
			newControl.commitChange()

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const { controlId } = input
			if (!validateCustomVariableControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const control = controlsMap.get(controlId) as ControlCustomVariable | undefined
			if (control) {
				control.destroy()

				customVariableNamesMap.removeCustomVariable(controlId, control.options.variableName)

				controlsMap.delete(controlId)

				dbTable.delete(controlId)

				return true
			}

			return false
		}),

		clone: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const { controlId } = input
			if (!validateCustomVariableControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const newControlId = CreateCustomVariableControlId(nanoid())

			const fromControl = controlsMap.get(controlId)
			if (fromControl && fromControl instanceof ControlCustomVariable) {
				const controlJson = fromControl.toJSON(true)

				const newControl = new ControlCustomVariable(deps, newControlId, controlJson, true)
				controlsMap.set(newControlId, newControl)

				customVariableNamesMap.addCustomVariable(newControlId, newControl.options.variableName)

				return newControlId
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

				const thisCustomVariable = controlsMap.get(controlId)
				if (!thisCustomVariable || !(thisCustomVariable instanceof ControlCustomVariable)) return false

				if (!customVariableCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the custom variable being moved if needed
				if (thisCustomVariable.options.collectionId !== (collectionId ?? undefined)) {
					thisCustomVariable.optionsSetField('collectionId', collectionId ?? undefined, true)
				}

				// find all the other triggers with the matching collectionId
				const sortedCustomVariables = Array.from(controlsMap.values())
					.filter(
						(control): control is ControlCustomVariable =>
							control.controlId !== controlId &&
							control instanceof ControlCustomVariable &&
							((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
					)
					.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

				if (dropIndex < 0) {
					// Push the trigger to the end of the array
					sortedCustomVariables.push(thisCustomVariable)
				} else {
					// Insert the trigger at the drop index
					sortedCustomVariables.splice(dropIndex, 0, thisCustomVariable)
				}

				// update the sort order of the connections in the store, tracking which ones changed
				sortedCustomVariables.forEach((customVariable, index) => {
					if (customVariable.options.sortOrder === index) return // No change

					customVariable.optionsSetField('sortOrder', index, true)
				})

				return true
			}),
	})
}
