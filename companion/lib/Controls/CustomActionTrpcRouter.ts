import type EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import z from 'zod'
import { isCustomActionsConnectionId } from '@companion-app/shared/ConnectionId.js'
import { CreateCustomActionControlId, ParseControlId } from '@companion-app/shared/ControlId.js'
import {
	CustomActionOutputSchema,
	getCustomActionCallDefinition,
	type ClientCustomActionData,
	type CustomActionsUpdate,
	type CustomActionsUpdateInitOp,
} from '@companion-app/shared/Model/CustomActionModel.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { ControlChangeEvents } from './ControlDependencies.js'
import type { ControlStore } from './ControlStore.js'
import { ControlCustomAction } from './ControlTypes/CustomAction.js'
import type { CustomActionCollections } from './CustomActionCollections.js'
import { createCustomEntityInputsProcedures } from './CustomEntities/CustomEntityTrpc.js'
import type { ControlsFactory } from './Factory.js'
import { validateCustomActionControlId } from './Util.js'

/**
 * Update the actions which run a custom action, after one of its outputs has been renamed, so that they keep where
 * the output is written
 * @param controlStore The store of all the controls
 * @param customActionControlId The control id of the custom action
 * @param fromId The old id of the output
 * @param toId The new id of the output
 */
export function renameCustomActionOutputInCallers(
	controlStore: ControlStore,
	customActionControlId: string,
	fromId: string,
	toId: string
): void {
	const parsedId = ParseControlId(customActionControlId)
	if (parsedId?.type !== 'custom-action') return

	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		let changed = false
		for (const entity of control.entities.getAllEntities()) {
			if (!isCustomActionsConnectionId(entity.connectionId) || entity.definitionId !== parsedId.customActionId) continue

			const target = entity.rawOutputTargets[fromId]
			if (!target) continue

			entity.setRawOutputTarget(fromId, undefined)
			entity.setRawOutputTarget(toId, target)
			changed = true
		}

		if (changed) control.commitChange(false)
	}
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomActionTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	customActionCollections: CustomActionCollections,
	controlStore: ControlStore,
	factory: ControlsFactory
) {
	function getCustomAction(controlId: string): ControlCustomAction | undefined {
		if (!validateCustomActionControlId(controlId)) return undefined

		const control = controlStore.controls.get(controlId)
		return control instanceof ControlCustomAction ? control : undefined
	}

	return router({
		collections: customActionCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<CustomActionsUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'customActionChange', opts.signal)

			const customActions: Record<string, ClientCustomActionData> = {}

			for (const [controlId, control] of controlStore.controls.entries()) {
				if (control instanceof ControlCustomAction) {
					customActions[controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', customActions } satisfies CustomActionsUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies CustomActionsUpdate
			}
		}),

		create: publicProcedure.input(z.object({ name: z.string() })).mutation(({ input }) => {
			const controlId = CreateCustomActionControlId(nanoid())
			const newControl = factory.createCustomAction(controlId)

			controlStore.controls.set(controlId, newControl)

			// Add to the end of the list
			const allCustomActions: ControlCustomAction[] = []
			for (const control of controlStore.controls.values()) {
				if (control instanceof ControlCustomAction) {
					allCustomActions.push(control)
				}
			}
			const maxRank = Math.max(0, ...allCustomActions.map((control) => control.options.sortOrder))
			newControl.optionsSetField('sortOrder', maxRank + 1, true)

			newControl.optionsSetField('name', input.name)

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const control = getCustomAction(input.controlId)
			if (!control) return false

			control.destroy()
			controlStore.deleteControl(input.controlId)

			return true
		}),

		clone: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const fromControl = getCustomAction(input.controlId)
			if (!fromControl) return false

			const newControlId = CreateCustomActionControlId(nanoid())

			const controlJson = fromControl.toJSON(true)
			controlJson.options.name = `${controlJson.options.name} (copy)`

			const newControl = factory.createCustomAction(newControlId, controlJson)
			controlStore.controls.set(newControlId, newControl)

			return newControlId
		}),

		testRun: publicProcedure.input(z.object({ controlId: z.string() })).mutation(({ input }) => {
			const control = getCustomAction(input.controlId)
			if (!control) return false

			control.testRun()
			return true
		}),

		...createCustomEntityInputsProcedures(controlStore, getCustomAction, getCustomActionCallDefinition),

		outputAdd: publicProcedure
			.input(z.object({ controlId: z.string(), output: CustomActionOutputSchema }))
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				return control.outputAdd(input.output)
			}),

		outputRemove: publicProcedure
			.input(z.object({ controlId: z.string(), outputId: z.string() }))
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				return control.outputRemove(input.outputId)
			}),

		outputMove: publicProcedure
			.input(z.object({ controlId: z.string(), outputId: z.string(), index: z.number().int().min(0) }))
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				return control.outputMove(input.outputId, input.index)
			}),

		outputUpdate: publicProcedure
			.input(z.object({ controlId: z.string(), outputId: z.string(), output: CustomActionOutputSchema }))
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				if (!control.outputUpdate(input.outputId, input.output)) return false

				// Make sure the actions using the custom action keep where a renamed output is written
				if (input.output.id !== input.outputId) {
					renameCustomActionOutputInCallers(controlStore, input.controlId, input.outputId, input.output.id)
				}

				return true
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

				const thisCustomAction = getCustomAction(controlId)
				if (!thisCustomAction) return false

				if (!customActionCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the custom action being moved if needed
				if (thisCustomAction.options.collectionId !== (collectionId ?? undefined)) {
					thisCustomAction.optionsSetField('collectionId', collectionId ?? undefined, true)
				}

				// find all the other custom actions with the matching collectionId
				const sortedCustomActions = controlStore.controls
					.values()
					.filter(
						(control): control is ControlCustomAction =>
							control.controlId !== controlId &&
							control instanceof ControlCustomAction &&
							((!control.options.collectionId && !collectionId) || control.options.collectionId === collectionId)
					)
					.toArray()
					.sort((a, b) => (a.options.sortOrder || 0) - (b.options.sortOrder || 0))

				if (dropIndex < 0) {
					// Push the custom action to the end of the array
					sortedCustomActions.push(thisCustomAction)
				} else {
					// Insert the custom action at the drop index
					sortedCustomActions.splice(dropIndex, 0, thisCustomAction)
				}

				// update the sort order of the custom actions in the store, tracking which ones changed
				sortedCustomActions.forEach((customAction, index) => {
					if (customAction.options.sortOrder === index) return // No change

					customAction.optionsSetField('sortOrder', index, true)
				})

				return true
			}),
	})
}
