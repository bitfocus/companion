import { CreateExpressionVariableControlId } from '@companion-app/shared/ControlId.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { SomeControl } from './IControlFragments.js'
import { nanoid } from 'nanoid'
import type { ControlChangeEvents, ControlDependencies } from './ControlDependencies.js'
import z from 'zod'
import type { DataStoreTableView } from '../Data/StoreBase.js'
import type EventEmitter from 'events'
import type { SomeControlModel } from '@companion-app/shared/Model/Controls.js'
import type { ExpressionVariableCollections } from './ExpressionVariableCollections.js'
import { ControlExpressionVariable } from './ControlTypes/ExpressionVariable.js'
import { validateExpressionVariableControlId } from './Util.js'
import type {
	ClientExpressionVariableData,
	ExpressionVariableUpdate,
	ExpressionVariableUpdateInitOp,
} from '@companion-app/shared/Model/ExpressionVariableModel.js'
import type { ExpressionVariableNameMap } from './ExpressionVariableNameMap.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createExpressionVariableTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	expressionVariableCollections: ExpressionVariableCollections,
	dbTable: DataStoreTableView<Record<string, SomeControlModel>>,
	controlsMap: Map<string, SomeControl<any>>,
	expressionVariableNamesMap: ExpressionVariableNameMap,
	deps: ControlDependencies
) {
	return router({
		collections: expressionVariableCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<ExpressionVariableUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'expressionVariableChange', opts.signal)

			const variables: Record<string, ClientExpressionVariableData> = {}

			for (const [controlId, control] of controlsMap.entries()) {
				if (control instanceof ControlExpressionVariable) {
					variables[controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', variables } satisfies ExpressionVariableUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies ExpressionVariableUpdate
			}
		}),

		create: publicProcedure.mutation(() => {
			// Create the initial entity for the expression variable
			const rootEntity = deps.instance.definitions.createEntityItem(
				'internal',
				EntityModelType.Feedback,
				'expression_value',
				null
			)
			if (!rootEntity) throw new Error('Failed to get initial entity for expression variable')

			const controlId = CreateExpressionVariableControlId(nanoid())
			const newControl = new ControlExpressionVariable(deps, expressionVariableNamesMap, controlId, null, false)

			if (!newControl.entities.entityAdd('feedbacks', null, rootEntity)) {
				throw new Error('Failed to add feedback entity to expression variable')
			}

			controlsMap.set(controlId, newControl)

			// Add variable to the end of the list
			const allExpressionVariables: ControlExpressionVariable[] = []
			for (const control of controlsMap.values()) {
				if (control instanceof ControlExpressionVariable) {
					allExpressionVariables.push(control)
				}
			}
			const maxRank = Math.max(0, ...allExpressionVariables.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank, true)

			// Add to names map (initially empty variableName, will be added when name is set)
			expressionVariableNamesMap.addExpressionVariable(controlId, newControl.options.variableName)

			// Ensure it is stored to the db
			newControl.commitChange()

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const { controlId } = input
			if (!validateExpressionVariableControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const control = controlsMap.get(controlId) as ControlExpressionVariable | undefined
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
			if (!validateExpressionVariableControlId(controlId)) {
				// Control id is not valid!
				return false
			}

			const newControlId = CreateExpressionVariableControlId(nanoid())

			const fromControl = controlsMap.get(controlId)
			if (fromControl && fromControl instanceof ControlExpressionVariable) {
				const controlJson = fromControl.toJSON(true)

				const newControl = new ControlExpressionVariable(
					deps,
					expressionVariableNamesMap,
					newControlId,
					controlJson,
					true
				)
				controlsMap.set(newControlId, newControl)

				expressionVariableNamesMap.addExpressionVariable(newControlId, newControl.options.variableName)

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

				const thisExpressionVariable = controlsMap.get(controlId)
				if (!thisExpressionVariable || !(thisExpressionVariable instanceof ControlExpressionVariable)) return false

				if (!expressionVariableCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the expression variable being moved if needed
				if (thisExpressionVariable.options.collectionId !== (collectionId ?? undefined)) {
					thisExpressionVariable.optionsSetField('collectionId', collectionId ?? undefined, true)
				}

				// find all the other triggers with the matching collectionId
				const sortedExpressionVariables = Array.from(controlsMap.values())
					.filter(
						(control): control is ControlExpressionVariable =>
							control.controlId !== controlId &&
							control instanceof ControlExpressionVariable &&
							((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
					)
					.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

				if (dropIndex < 0) {
					// Push the trigger to the end of the array
					sortedExpressionVariables.push(thisExpressionVariable)
				} else {
					// Insert the trigger at the drop index
					sortedExpressionVariables.splice(dropIndex, 0, thisExpressionVariable)
				}

				// update the sort order of the connections in the store, tracking which ones changed
				sortedExpressionVariables.forEach((expressionVariable, index) => {
					if (expressionVariable.options.sortOrder === index) return // No change

					expressionVariable.optionsSetField('sortOrder', index, true)
				})

				return true
			}),
	})
}
