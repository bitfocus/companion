import type EventEmitter from 'node:events'
import { nanoid } from 'nanoid'
import z from 'zod'
import {
	CreateCustomActionControlId,
	zodControlIds,
	type CustomActionControlId,
} from '@companion-app/shared/ControlId.js'
import {
	type ClientCustomActionData,
	type CustomActionsUpdate,
	type CustomActionsUpdateInitOp,
	type CustomActionUsage,
	type CustomActionUse,
} from '@companion-app/shared/Model/CustomActionModel.js'
import { publicProcedure, router, throttleIterator, toIterable } from '../UI/TRPC.js'
import { getBuildingBlockUses } from './BuildingBlocks/BuildingBlockCallers.js'
import { createBuildingBlockInputsTrpcRouter } from './BuildingBlocks/BuildingBlockInputsTrpcRouter.js'
import type { ControlChangeEvents } from './ControlDependencies.js'
import { moveControlInCollection } from './ControlOrder.js'
import type { ControlStore } from './ControlStore.js'
import { ControlCustomAction } from './ControlTypes/CustomAction.js'
import type { CustomActionCollections } from './CustomActionCollections.js'
import type { CustomActionInstanceManager } from './CustomActions/CustomActionInstanceManager.js'
import type { ControlsFactory } from './Factory.js'

/** How often the usage of a custom action is sent at most, as runs inside a loop start and finish rapidly */
const USAGE_UPDATE_INTERVAL_MS = 100

/**
 * What calls a custom action, and its runs in progress
 * @param controlStore The store of all the controls
 * @param customActionInstances The copies and runs of the custom actions
 * @param customActionControlId The control id of the custom action
 */
function getCustomActionUsage(
	controlStore: ControlStore,
	customActionInstances: CustomActionInstanceManager,
	customActionControlId: CustomActionControlId
): CustomActionUsage {
	const runsByUse = Map.groupBy(customActionInstances.getRuns(customActionControlId), (run) => run.useEntityId)

	const uses: CustomActionUse[] = getBuildingBlockUses(controlStore, customActionControlId).map((use) => {
		const runs = (runsByUse.get(use.entityId) ?? []).map(({ run }) => run)
		runsByUse.delete(use.entityId)
		return { ...use, runs }
	})

	return { uses, otherRuns: [...runsByUse.values()].flat().map(({ run }) => run) }
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function createCustomActionTrpcRouter(
	changeEvents: EventEmitter<ControlChangeEvents>,
	customActionCollections: CustomActionCollections,
	controlStore: ControlStore,
	factory: ControlsFactory,
	customActionInstances: CustomActionInstanceManager
) {
	function getCustomAction(controlId: CustomActionControlId): ControlCustomAction | undefined {
		const control = controlStore.controls.get(controlId)
		return control instanceof ControlCustomAction ? control : undefined
	}

	return router({
		collections: customActionCollections.createTrpcRouter(),

		watch: publicProcedure.subscription<AsyncIterable<CustomActionsUpdate>>(async function* (opts) {
			const changes = toIterable(changeEvents, 'customActionChange', opts.signal)

			const customActions: Record<CustomActionControlId, ClientCustomActionData> = {}

			for (const control of controlStore.controls.values()) {
				if (control instanceof ControlCustomAction) {
					customActions[control.controlId] = control.toClientJSON()
				}
			}

			yield { type: 'init', customActions } satisfies CustomActionsUpdateInitOp

			for await (const [_controlId, data] of changes) {
				yield data satisfies CustomActionsUpdate
			}
		}),

		watchUsage: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-action'] }))
			.subscription(async function* ({ input, signal }) {
				const changes = throttleIterator(
					toIterable(customActionInstances.events, 'usageChanged', signal),
					USAGE_UPDATE_INTERVAL_MS
				)

				yield getCustomActionUsage(controlStore, customActionInstances, input.controlId)

				for await (const _change of changes) {
					yield getCustomActionUsage(controlStore, customActionInstances, input.controlId)
				}
			}),

		abortUse: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-action'], entityId: z.string() }))
			.mutation(({ input }) => customActionInstances.abortRuns(input.controlId, input.entityId)),

		abortAll: publicProcedure.input(z.object({ controlId: zodControlIds['custom-action'] })).mutation(({ input }) => {
			getCustomAction(input.controlId)?.abortDelayedActions(false, null)
			return customActionInstances.abortRuns(input.controlId, null)
		}),

		abortTestRun: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-action'] }))
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				control.abortDelayedActions(false, null)
				return true
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
			newControl.optionsSetField({ key: 'sortOrder', value: maxRank + 1 }, true)

			newControl.optionsSetField({ key: 'name', value: input.name })

			return controlId
		}),

		delete: publicProcedure.input(z.object({ controlId: zodControlIds['custom-action'] })).mutation(({ input }) => {
			const control = getCustomAction(input.controlId)
			if (!control) return false

			control.destroy()
			controlStore.deleteControl(input.controlId)

			return true
		}),

		clone: publicProcedure.input(z.object({ controlId: zodControlIds['custom-action'] })).mutation(({ input }) => {
			const fromControl = getCustomAction(input.controlId)
			if (!fromControl) return false

			const newControlId = CreateCustomActionControlId(nanoid())

			const controlJson = structuredClone(fromControl.toJSON())
			controlJson.options.name = `${controlJson.options.name} (copy)`

			const newControl = factory.createCustomAction(newControlId, controlJson)
			controlStore.controls.set(newControlId, newControl)

			return newControlId
		}),

		testRun: publicProcedure.input(z.object({ controlId: zodControlIds['custom-action'] })).mutation(({ input }) => {
			const control = getCustomAction(input.controlId)
			if (!control) return false

			control.testRun()
			return true
		}),

		inputs: createBuildingBlockInputsTrpcRouter(controlStore, zodControlIds['custom-action'], getCustomAction),

		outputSet: publicProcedure
			.input(
				z.object({
					controlId: zodControlIds['custom-action'],
					variableName: z.string(),
					label: z.string().nullable(),
				})
			)
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				return control.outputSet(input.variableName, input.label)
			}),

		reorder: publicProcedure
			.input(
				z.object({
					collectionId: z.string().nullable(),
					controlId: zodControlIds['custom-action'],
					dropIndex: z.number(),
				})
			)
			.mutation(({ input }) => {
				const thisCustomAction = getCustomAction(input.controlId)
				if (!thisCustomAction) return false

				if (!customActionCollections.doesCollectionIdExist(input.collectionId)) return false

				const allCustomActions = controlStore.controls
					.values()
					.filter((control) => control instanceof ControlCustomAction)
					.toArray()
				moveControlInCollection(allCustomActions, thisCustomAction, input.collectionId, input.dropIndex)

				return true
			}),
	})
}
