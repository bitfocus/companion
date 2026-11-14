import type { CustomActionControlId } from '@companion-app/shared/ControlId.js'
import { updateBuildingBlockCallers } from '../BuildingBlocks/BuildingBlockCallers.js'
import type { ControlStore } from '../ControlStore.js'

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
	updateBuildingBlockCallers(controlStore, customActionControlId, (entity) => {
		let changed = false
		for (const outputId of Object.keys(entity.rawOutputTargets)) {
			if (outputIds.has(outputId)) continue
			entity.setRawOutputTarget(outputId, null)
			changed = true
		}
		return changed
	})
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
	updateBuildingBlockCallers(controlStore, customActionControlId, (entity) => {
		const target = entity.rawOutputTargets[fromId]
		if (!target) return false

		entity.setRawOutputTarget(fromId, null)
		entity.setRawOutputTarget(toId, target)
		return true
	})
}
