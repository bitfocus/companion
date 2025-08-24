import { CreateComputedVariableControlId } from '@companion-app/shared/ControlId.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'
import { nanoid } from 'nanoid'
import type { ControlChangeEvents, ControlDependencies } from './ControlDependencies.js'
import z from 'zod'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type EventEmitter from 'events'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type { ComputedVariableCollections } from '../Variables/ComputedVariableCollections.js'
import { ControlComputedVariable } from './ControlTypes/ComputedVariable.js'
import { validateComputedVariableControlId } from './Util.js'
import {
	ClientComputedVariableData,
	ComputedVariableUpdate,
	ComputedVariableUpdateInitOp,
} from '@companion-app/shared/Model/ComputedVariableModel.js'
import type { ComputedVariableNameMap } from './ComputedVariableNameMap.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createComputedVariablesTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	computedVariableCollections: ComputedVariableCollections,
	dbTable: DataStoreTableView<Record<string, SomeControlModel>>,
	controlsMap: Map<string, SomeControl<any>>,
	computedVariableNamesMap: ComputedVariableNameMap,
	deps: ControlDependencies
) {
	return router({
		collections: computedVariableCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<ComputedVariableUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'computedVariableChange', opts.signal)

			const variables: Record<string, ClientComputedVariableData> = {}

			for (const [controlId, control] of controlsMap.entries()) {
				if (control instanceof ControlComputedVariable) {
					variables[controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', variables } satisfies ComputedVariableUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies ComputedVariableUpdate
			}
		}),

		create: publicProcedure.mutation(() => {
			// Create the initial entity for the computed variable
			const rootEntity = deps.instance.definitions.createEntityItem(
				'internal',
				EntityModelType.Feedback,
				'expression_value'
			)
			if (!rootEntity) throw new Error('Failed to get initial entity for computed variable')

			const controlId = CreateComputedVariableControlId(nanoid())
			const newControl = new ControlComputedVariable(deps, computedVariableNamesMap, controlId, null, false)

			if (!newControl.entities.entityAdd('feedbacks', null, rootEntity)) {
				throw new Error('Failed to add feedback entity to computed variable')
			}

			controlsMap.set(controlId, newControl)

			// Add variable to the end of the list
			const allComputedVariables: ControlComputedVariable[] = []
			for (const control of controlsMap.values()) {
				if (control instanceof ControlComputedVariable) {
					allComputedVariables.push(control)
				}
			}
			const maxRank = Math.max(0, ...allComputedVariables.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank, true)

			// Add to names map (initially empty variableName, will be added when name is set)
			computedVariableNamesMap.addComputedVariable(controlId, newControl.options.variableName)

			// Ensure it is stored to the db
			newControl.commitChange()

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const { controlId } = input
			if (!validateComputedVariableControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const control = controlsMap.get(controlId) as ControlComputedVariable | undefined
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
			if (!validateComputedVariableControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const newControlId = CreateComputedVariableControlId(nanoid())

			const fromControl = controlsMap.get(controlId)
			if (fromControl && fromControl instanceof ControlComputedVariable) {
				const controlJson = fromControl.toJSON(true)

				const newControl = new ControlComputedVariable(deps, computedVariableNamesMap, newControlId, controlJson, true)
				controlsMap.set(newControlId, newControl)

				computedVariableNamesMap.addComputedVariable(newControlId, newControl.options.variableName)

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

				const thisComputedVariable = controlsMap.get(controlId)
				if (!thisComputedVariable || !(thisComputedVariable instanceof ControlComputedVariable)) return false

				if (!computedVariableCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the computed variable being moved if needed
				if (thisComputedVariable.options.collectionId !== (collectionId ?? undefined)) {
					thisComputedVariable.optionsSetField('collectionId', collectionId ?? undefined, true)
				}

				// find all the other triggers with the matching collectionId
				const sortedComputedVariables = Array.from(controlsMap.values())
					.filter(
						(control): control is ControlComputedVariable =>
							control.controlId !== controlId &&
							control instanceof ControlComputedVariable &&
							((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
					)
					.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

				if (dropIndex < 0) {
					// Push the trigger to the end of the array
					sortedComputedVariables.push(thisComputedVariable)
				} else {
					// Insert the trigger at the drop index
					sortedComputedVariables.splice(dropIndex, 0, thisComputedVariable)
				}

				// update the sort order of the connections in the store, tracking which ones changed
				sortedComputedVariables.forEach((computedVariable, index) => {
					if (computedVariable.options.sortOrder === index) return // No change

					computedVariable.optionsSetField('sortOrder', index, true)
				})

				return true
			}),
	})
}
