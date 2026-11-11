import { isCustomActionsConnectionId } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId, type CustomActionControlId } from '@companion-app/shared/ControlId.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { ControlStore } from '../ControlStore.js'

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
