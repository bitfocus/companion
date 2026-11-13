import type { SomeControlId } from '@companion-app/shared/ControlId.js'
import { getCustomActionCallDefinition } from '@companion-app/shared/Model/CustomActionModel.js'
import { getCustomFeedbackCallDefinition } from '@companion-app/shared/Model/CustomFeedbackModel.js'
import type { ExpressionableOptionsObject } from '@companion-app/shared/Model/Options.js'
import type { ControlStore } from '../ControlStore.js'
import type { ControlEntityInstance } from '../Entities/EntityInstance.js'

/**
 * Visit each action or feedback which uses a building block, saving each control in which one was changed
 * @param controlStore The store of all the controls
 * @param buildingBlockControlId The control id of the building block
 * @param update Visits an entity which uses it, and the control holding it, returning whether it changed the entity
 */
export function updateBuildingBlockCallers(
	controlStore: ControlStore,
	buildingBlockControlId: SomeControlId,
	update: (entity: ControlEntityInstance, controlId: SomeControlId) => boolean
): void {
	const call =
		getCustomActionCallDefinition(buildingBlockControlId) ?? getCustomFeedbackCallDefinition(buildingBlockControlId)
	if (!call) return

	for (const control of controlStore.controls.values()) {
		if (!control.supportsEntities) continue

		let changed = false
		for (const entity of control.entities.getAllEntities()) {
			if (entity.connectionId !== call.connectionId || entity.definitionId !== call.definitionId) continue
			if (update(entity, control.controlId)) changed = true
		}

		if (changed) control.commitChange(false)
	}
}

/**
 * Update what uses a building block after one of its inputs has been renamed, so that each keeps its value for it
 * @param controlStore The store of all the controls
 * @param buildingBlockControlId The control id of the building block
 * @param fromId The old id of the input
 * @param toId The new id of the input
 */
export function renameBuildingBlockInputInCallers(
	controlStore: ControlStore,
	buildingBlockControlId: SomeControlId,
	fromId: string,
	toId: string
): void {
	updateBuildingBlockCallers(controlStore, buildingBlockControlId, (entity) => {
		if (!(fromId in entity.rawOptions)) return false

		const newOptions: ExpressionableOptionsObject = {}
		for (const [key, value] of Object.entries(entity.rawOptions)) {
			newOptions[key === fromId ? toId : key] = value
		}
		entity.setOptions(newOptions)
		return true
	})
}

/**
 * Remove the value given by what uses a building block for one of its inputs, after it has been removed, so that a new
 * input with the same id doesn't pick it up
 * @param controlStore The store of all the controls
 * @param buildingBlockControlId The control id of the building block
 * @param inputId The id of the removed input
 */
export function removeBuildingBlockInputInCallers(
	controlStore: ControlStore,
	buildingBlockControlId: SomeControlId,
	inputId: string
): void {
	updateBuildingBlockCallers(controlStore, buildingBlockControlId, (entity) => {
		if (!(inputId in entity.rawOptions)) return false

		const { [inputId]: _removed, ...newOptions } = entity.rawOptions
		entity.setOptions(newOptions)
		return true
	})
}

/** An action or feedback which uses a building block */
export interface BuildingBlockUse {
	/** The control holding it, which may be another building block */
	readonly controlId: SomeControlId
	readonly entityId: string
	readonly disabled: boolean
}

/**
 * The actions or feedbacks which use a building block
 * @param controlStore The store of all the controls
 * @param buildingBlockControlId The control id of the building block
 */
export function getBuildingBlockUses(
	controlStore: ControlStore,
	buildingBlockControlId: SomeControlId
): BuildingBlockUse[] {
	const uses: BuildingBlockUse[] = []
	updateBuildingBlockCallers(controlStore, buildingBlockControlId, (entity, controlId) => {
		uses.push({ controlId, entityId: entity.id, disabled: !!entity.disabled })
		return false
	})
	return uses
}
