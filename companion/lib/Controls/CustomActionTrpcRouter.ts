import type EventEmitter from 'node:events'
import { setTimeout } from 'node:timers/promises'
import { nanoid } from 'nanoid'
import z from 'zod'
import { isCustomActionsConnectionId } from '@companion-app/shared/ConnectionId.js'
import {
	CreateCustomActionControlId,
	ParseControlId,
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
import { AuthorableInputFieldSchema, type ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { ControlChangeEvents } from './ControlDependencies.js'
import type { ControlStore } from './ControlStore.js'
import { ControlCustomAction } from './ControlTypes/CustomAction.js'
import type { CustomActionCollections } from './CustomActionCollections.js'
import type { CustomActionInstanceManager } from './CustomActions/CustomActionInstanceManager.js'
import type { ControlsFactory } from './Factory.js'

/**
 * Update the actions which run a custom action, after one of its inputs has been renamed
 * @param controlStore The store of all the controls
 * @param customActionControlId The control id of the custom action
 * @param fromId The old id of the input
 * @param toId The new id of the input
 */
export function renameCustomActionInputInCallers(
	controlStore: ControlStore,
	customActionControlId: CustomActionControlId,
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
			if (!(fromId in entity.rawOptions)) continue

			const newOptions: ExpressionableOptionsObject = {}
			for (const [key, value] of Object.entries(entity.rawOptions)) {
				newOptions[key === fromId ? toId : key] = value
			}
			entity.setOptions(newOptions)
			changed = true
		}

		if (changed) control.commitChange(false)
	}
}

/**
 * Remove the value given by the actions which run a custom action for one of its inputs, after it has been removed, so
 * that a new input with the same id doesn't pick it up
 * @param controlStore The store of all the controls
 * @param customActionControlId The control id of the custom action
 * @param inputId The id of the removed input
 */
export function removeCustomActionInputInCallers(
	controlStore: ControlStore,
	customActionControlId: CustomActionControlId,
	inputId: string
): void {
	const parsedId = ParseControlId(customActionControlId)
	if (parsedId?.type !== 'custom-action') return

	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		let changed = false
		for (const entity of control.entities.getAllEntities()) {
			if (!isCustomActionsConnectionId(entity.connectionId) || entity.definitionId !== parsedId.customActionId) continue
			if (!(inputId in entity.rawOptions)) continue

			const { [inputId]: _removed, ...newOptions } = entity.rawOptions
			entity.setOptions(newOptions)
			changed = true
		}

		if (changed) control.commitChange(false)
	}
}

/**
 * Remove where the actions which run a custom action write outputs which it no longer has, so that a new output of the
 * same name doesn't write there
 * @param controlStore The store of all the controls
 * @param customActionControlId The control id of the custom action
 * @param outputIds The ids of the outputs it has
 */
export function pruneCustomActionOutputTargetsInCallers(
	controlStore: ControlStore,
	customActionControlId: CustomActionControlId,
	outputIds: ReadonlySet<string>
): void {
	const parsedId = ParseControlId(customActionControlId)
	if (parsedId?.type !== 'custom-action') return

	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		let changed = false
		for (const entity of control.entities.getAllEntities()) {
			if (!isCustomActionsConnectionId(entity.connectionId) || entity.definitionId !== parsedId.customActionId) continue

			for (const outputId of Object.keys(entity.rawOutputTargets)) {
				if (outputIds.has(outputId)) continue
				entity.setRawOutputTarget(outputId, null)
				changed = true
			}
		}

		if (changed) control.commitChange(false)
	}
}

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
	customActionControlId: CustomActionControlId,
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

			entity.setRawOutputTarget(fromId, null)
			entity.setRawOutputTarget(toId, target)
			changed = true
		}

		if (changed) control.commitChange(false)
	}
}

/** How often the usage of a custom action is sent at most, as runs inside a loop start and finish rapidly */
const USAGE_UPDATE_INTERVAL_MS = 100

/**
 * What calls a custom action, and its runs in progress
 * @param controlStore The store of all the controls
 * @param customActionInstances The copies and runs of the custom actions
 * @param customActionControlId The control id of the custom action
 */
export function getCustomActionUsage(
	controlStore: ControlStore,
	customActionInstances: CustomActionInstanceManager,
	customActionControlId: CustomActionControlId
): CustomActionUsage {
	const parsedId = ParseControlId(customActionControlId)
	if (parsedId?.type !== 'custom-action') return { uses: [], otherRuns: [] }

	const runsByUse = Map.groupBy(customActionInstances.getRuns(customActionControlId), (run) => run.useEntityId)

	const uses: CustomActionUse[] = []
	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		for (const entity of control.entities.getAllEntities()) {
			if (!isCustomActionsConnectionId(entity.connectionId) || entity.definitionId !== parsedId.customActionId) continue

			uses.push({
				controlId: control.controlId,
				entityId: entity.id,
				disabled: !!entity.disabled,
				runs: (runsByUse.get(entity.id) ?? []).map(({ run }) => run),
			})
			runsByUse.delete(entity.id)
		}
	}

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
				// Send the latest when something has changed, rather than every change
				let changed = true
				let wake: (() => void) | null = null
				const onChange = () => {
					changed = true
					wake?.()
				}
				customActionInstances.events.on('usageChanged', onChange)
				const onAbort = () => wake?.()
				signal?.addEventListener('abort', onAbort)

				try {
					while (!signal?.aborted) {
						if (!changed) await new Promise<void>((resolve) => (wake = resolve))
						wake = null
						if (signal?.aborted) break

						changed = false
						yield getCustomActionUsage(controlStore, customActionInstances, input.controlId)

						await setTimeout(USAGE_UPDATE_INTERVAL_MS)
					}
				} finally {
					customActionInstances.events.off('usageChanged', onChange)
					signal?.removeEventListener('abort', onAbort)
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

		inputAdd: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-action'], field: AuthorableInputFieldSchema }))
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				return control.inputAdd(input.field)
			}),

		inputRemove: publicProcedure
			.input(z.object({ controlId: zodControlIds['custom-action'], inputId: z.string() }))
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				if (!control.inputRemove(input.inputId)) return false

				removeCustomActionInputInCallers(controlStore, input.controlId, input.inputId)

				return true
			}),

		inputMove: publicProcedure
			.input(
				z.object({ controlId: zodControlIds['custom-action'], inputId: z.string(), index: z.number().int().min(0) })
			)
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				return control.inputMove(input.inputId, input.index)
			}),

		inputUpdate: publicProcedure
			.input(
				z.object({ controlId: zodControlIds['custom-action'], inputId: z.string(), field: AuthorableInputFieldSchema })
			)
			.mutation(({ input }) => {
				const control = getCustomAction(input.controlId)
				if (!control) return false

				if (!control.inputUpdate(input.inputId, input.field)) return false

				// Make sure the actions using the custom action keep their value for a renamed input
				if (input.field.id !== input.inputId) {
					renameCustomActionInputInCallers(controlStore, input.controlId, input.inputId, input.field.id)
				}

				return true
			}),

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
				const { collectionId, controlId, dropIndex } = input

				const thisCustomAction = getCustomAction(controlId)
				if (!thisCustomAction) return false

				if (!customActionCollections.doesCollectionIdExist(collectionId)) return false

				// update the collectionId of the custom action being moved if needed
				if (thisCustomAction.options.collectionId !== (collectionId ?? undefined)) {
					thisCustomAction.optionsSetField({ key: 'collectionId', value: collectionId ?? undefined }, true)
				}

				// find all the other custom actions with the matching collectionId
				const sortedCustomActions = controlStore.controls
					.values()
					.filter(
						(control): control is ControlCustomAction =>
							control instanceof ControlCustomAction &&
							control.controlId !== controlId &&
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

					customAction.optionsSetField({ key: 'sortOrder', value: index }, true)
				})

				return true
			}),
	})
}
