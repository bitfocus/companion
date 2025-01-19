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

	/**
	 * Get the index of the current (next to execute) step
	 * @returns The index of current step
	 */
	getActiveStepIndex(): number

	/**
	 * Add a step to this control
	 * @returns Id of new step
	 */
	stepAdd(): string

	/**
	 * Progress through the action-sets
	 * @param amount Number of steps to progress
	 */
	stepAdvanceDelta(amount: number): boolean

	/**
	 * Duplicate a step on this control
	 * @param stepId the id of the step to duplicate
	 */
	stepDuplicate(stepId: string): boolean

	/**
	 * Set the current (next to execute) action-set by index
	 * @param index The step index to make the next
	 */
	stepMakeCurrent(index: number): boolean

	/**
	 * Remove an action-set from this control
	 * @param stepId the id of the action-set
	 */
	stepRemove(stepId: string): boolean

	/**
	 * Set the current (next to execute) action-set by id
	 * @param stepId The step id to make the next
	 */
	stepSelectCurrent(stepId: string): boolean

	/**
	 * Swap two action-sets
	 * @param stepId1 One of the action-sets
	 * @param stepId2 The other action-set
	 */
	stepSwap(stepId1: string, stepId2: string): boolean

	/**
	 * Rename step
	 * @param stepId the id of the action-set
	 * @param newName The new name of the step
	 */
	stepRename(stepId: string, newName: string): boolean
}
