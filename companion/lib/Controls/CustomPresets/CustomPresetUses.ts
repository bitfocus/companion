import { isCustomConnectionId } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId, type SomeControlId } from '@companion-app/shared/ControlId.js'
import type { CustomPresetUse } from '@companion-app/shared/Model/CustomPresetModel.js'
import type { ControlStore } from '../ControlStore.js'
import { ControlButtonPresetReference } from '../ControlTypes/Button/PresetReference.js'

/**
 * The buttons which are linked to a custom preset. A copy of it is a button of its own, so isn't a use
 * @param controlStore The store of all the controls
 * @param customPresetControlId The control id of the custom preset
 */
export function getCustomPresetUses(
	controlStore: ControlStore,
	customPresetControlId: SomeControlId
): CustomPresetUse[] {
	const parsedId = ParseControlId(customPresetControlId)
	if (parsedId?.type !== 'custom-preset') return []

	const uses: CustomPresetUse[] = []
	for (const control of controlStore.controls.values()) {
		if (
			control instanceof ControlButtonPresetReference &&
			isCustomConnectionId(control.connectionId) &&
			control.presetId === parsedId.customPresetId
		) {
			uses.push({ controlId: control.controlId })
		}
	}

	return uses
}
