import type { ActionSetId } from '@companion-app/shared/Model/ActionModel.js'

export interface ControlActionSetAndStepsManager {
	/**
	 * Add an action set to this control
	 */
	actionSetAdd(stepId: string): boolean

	/**
	 * Remove an action-set from this control
	 */
	actionSetRemove(stepId: string, setId: ActionSetId): boolean

	/**
	 * Rename an action-sets
	 */
	actionSetRename(stepId: string, oldSetId: ActionSetId, newSetId: ActionSetId): boolean

	/**
	 * Set whether an action-set should run while the button is held
	 */
	actionSetRunWhileHeld(stepId: string, setId: ActionSetId, runWhileHeld: boolean): boolean
}
