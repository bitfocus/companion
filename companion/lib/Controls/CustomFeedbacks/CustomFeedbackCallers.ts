import { isCustomFeedbacksConnectionId } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId, type CustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { ControlStore } from '../ControlStore.js'

/**
 * Update the feedbacks which use a custom feedback, after one of its inputs has been renamed
 * @param controlStore The store of all the controls
 * @param customFeedbackControlId The control id of the custom feedback
 * @param fromId The old id of the input
 * @param toId The new id of the input
 */
export function renameCustomFeedbackInputInCallers(
	controlStore: ControlStore,
	customFeedbackControlId: CustomFeedbackControlId,
	fromId: string,
	toId: string
): void {
	const parsedId = ParseControlId(customFeedbackControlId)
	if (parsedId?.type !== 'custom-feedback') return

	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		let changed = false
		for (const entity of control.entities.getAllEntities()) {
			if (!isCustomFeedbacksConnectionId(entity.connectionId) || entity.definitionId !== parsedId.customFeedbackId)
				continue
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
 * Remove the value given by the feedbacks which use a custom feedback for one of its inputs, after it has been removed,
 * so that a new input with the same id doesn't pick it up
 * @param controlStore The store of all the controls
 * @param customFeedbackControlId The control id of the custom feedback
 * @param inputId The id of the removed input
 */
export function removeCustomFeedbackInputInCallers(
	controlStore: ControlStore,
	customFeedbackControlId: CustomFeedbackControlId,
	inputId: string
): void {
	const parsedId = ParseControlId(customFeedbackControlId)
	if (parsedId?.type !== 'custom-feedback') return

	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		let changed = false
		for (const entity of control.entities.getAllEntities()) {
			if (!isCustomFeedbacksConnectionId(entity.connectionId) || entity.definitionId !== parsedId.customFeedbackId)
				continue
			if (!(inputId in entity.rawOptions)) continue

			const { [inputId]: _removed, ...newOptions } = entity.rawOptions
			entity.setOptions(newOptions)
			changed = true
		}

		if (changed) control.commitChange(false)
	}
}
