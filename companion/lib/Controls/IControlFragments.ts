import type { ButtonStatus } from '@companion-app/shared/Model/ButtonModel.js'
import type { ControlBase } from './ControlBase.js'
import type { FragmentFeedbacks } from './Fragments/FragmentFeedbacks.js'
import type { ActionInstance } from '@companion-app/shared/Model/ActionModel.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'

export type SomeControl<TJson> = ControlBase<TJson> &
	(ControlWithSteps | ControlWithoutSteps) &
	(ControlWithStyle | ControlWithoutStyle) &
	(ControlWithFeedbacks | ControlWithoutFeedbacks) &
	(ControlWithActions | ControlWithoutActions) &
	(ControlWithEvents | ControlWithoutEvents) &
	(ControlWithActionSets | ControlWithoutActionSets) &
	(ControlWithOptions | ControlWithoutOptions) &
	(ControlWithPushed | ControlWithoutPushed)

export interface ControlWithSteps extends ControlBase<any> {
	readonly supportsSteps: true

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

export interface ControlWithoutSteps extends ControlBase<any> {
	readonly supportsSteps: false
}

export interface ControlWithStyle extends ControlBase<any> {
	readonly supportsStyle: true

	readonly button_status: ButtonStatus

	/**
	 * Update the style fields of this control
	 * @param diff - config diff to apply
	 * @returns true if any changes were made
	 */
	styleSetFields(diff: Record<string, any>): boolean

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: Set<string>): void
}

export interface ControlWithoutStyle extends ControlBase<any> {
	readonly supportsStyle: false
}

export interface ControlWithFeedbacks extends ControlBase<any> {
	readonly supportsFeedbacks: true

	readonly feedbacks: FragmentFeedbacks

	/**
	 * Remove any tracked state for an connection
	 */
	clearConnectionState(connectionId: string): void

	/**
	 * Update all controls to forget an connection
	 */
	forgetConnection(connectionId: string): void
}

export interface ControlWithoutFeedbacks extends ControlBase<any> {
	readonly supportsFeedbacks: false
}

export interface ControlWithActions extends ControlBase<any> {
	readonly supportsActions: true

	readonly has_actions_running: boolean

	/**
	 * Add an action to this control
	 */
	actionAdd(stepId: string, setId: string, actionItem: ActionInstance): boolean

	/**
	 * Append some actions to this button
	 * @param stepId
	 * @param setId the action_set id to update
	 * @param newActions actions to append
	 */
	actionAppend(stepId: string, setId: string, newActions: ActionInstance[]): boolean

	/**
	 * Duplicate an action on this control
	 */
	actionDuplicate(stepId: string, setId: string, id: string): string | null

	/**
	 * Enable or disable an action
	 */
	actionEnabled(stepId: string, setId: string, id: string, enabled: boolean): boolean

	/**
	 * Set action headline
	 */
	actionHeadline(stepId: string, setId: string, id: string, headline: string): boolean

	/**
	 * Learn the options for an action, by asking the connection for the current values
	 */
	actionLearn(stepId: string, setId: string, id: string): Promise<boolean>

	/**
	 * Remove an action from this control
	 */
	actionRemove(stepId: string, setId: string, id: string): boolean

	/**
	 * Reorder an action in the list or move between sets
	 */
	actionReorder(
		dragStepId: string,
		dragSetId: string,
		dragIndex: number,
		dropStepId: string,
		dropSetId: string,
		dropIndex: number
	): boolean

	/**
	 * Remove an action from this control
	 */
	actionReplace(newProps: Pick<ActionInstance, 'id' | 'action' | 'options'>, skipNotifyModule?: boolean): boolean

	/**
	 * Replace all the actions in a set
	 */
	actionReplaceAll(stepId: string, setId: string, newActions: ActionInstance[]): boolean

	/**
	 * Set the delay of an action
	 */
	actionSetDelay(stepId: string, setId: string, id: string, delay: number): boolean

	/**
	 * Set an opton of an action
	 */
	actionSetOption(stepId: string, setId: string, id: string, key: string, value: any): boolean

	/**
	 * Remove any tracked state for a connection
	 */
	clearConnectionState(connectionId: string): void

	/**
	 * Update all controls to forget a connection
	 */
	forgetConnection(connectionId: string): void

	/**
	 * Get all the actions on this control
	 */
	getAllActions(): ActionInstance[]

	/**
	 * Mark the button as having pending delayed actions
	 * @param running Whether any delayed actions are pending
	 * @param skip_up Mark the button as released, skipping the release actions
	 */
	setActionsRunning(running: boolean, skip_up: boolean): void
}

export interface ControlWithoutActions extends ControlBase<any> {
	readonly supportsActions: false
}

export interface ControlWithEvents extends ControlBase<any> {
	readonly supportsEvents: true

	/**
	 * Add an event to this control
	 */
	eventAdd(_eventItem: EventInstance): boolean

	/**
	 * Duplicate an event on this control
	 */
	eventDuplicate(id: string): boolean

	/**
	 * Enable or disable an event
	 */
	eventEnabled(id: string, enabled: boolean): boolean

	/**
	 * Set event headline
	 */
	eventHeadline(id: string, headline: string): boolean

	/**
	 * Remove an event from this control
	 */
	eventRemove(id: string): boolean

	/**
	 * Reorder an event in the list
	 * @param oldIndex the index of the event to move
	 * @param newIndex the target index of the event
	 */
	eventReorder(oldIndex: number, newIndex: number): boolean

	/**
	 * Update an option for an event
	 * @param id the id of the event
	 * @param key the key/name of the property
	 * @param value the new value
	 */
	eventSetOptions(id: string, key: string, value: any): boolean
}

export interface ControlWithoutEvents extends ControlBase<any> {
	readonly supportsEvents: false
}

export interface ControlWithActionSets extends ControlBase<any> {
	readonly supportsActionSets: true

	/**
	 * Add an action set to this control
	 */
	actionSetAdd(stepId: string): boolean

	/**
	 * Remove an action-set from this control
	 */
	actionSetRemove(stepId: string, setId: string): boolean

	/**
	 * Rename an action-sets
	 */
	actionSetRename(stepId: string, oldSetId: string, newSetId: string): boolean

	/**
	 * Set whether an action-set should run while the button is held
	 */
	actionSetRunWhileHeld(stepId: string, setId: string, runWhileHeld: boolean): boolean

	/**
	 * Execute a rotate of this control
	 * @param direction Whether the control was rotated to the right
	 * @param surfaceId The surface that intiated this rotate
	 */
	rotateControl(direction: boolean, surfaceId: string | undefined): void
}

export interface ControlWithoutActionSets extends ControlBase<any> {
	readonly supportsActionSets: false
}

export interface ControlWithOptions extends ControlBase<any> {
	readonly supportsOptions: true

	options: Record<string, any>

	/**
	 * Update an option field of this control
	 */
	optionsSetField(key: string, value: any, forceSet?: boolean): boolean
}

export interface ControlWithoutOptions extends ControlBase<any> {
	readonly supportsOptions: false
}

export interface ControlWithPushed extends ControlBase<any> {
	readonly supportsPushed: true

	readonly pushed: boolean

	/**
	 * Set the button as being pushed.
	 * Notifies interested observers
	 * @param direction new state
	 * @param surfaceId device which triggered the change
	 * @returns the pushed state changed
	 * @access public
	 */
	setPushed(direction: boolean, surfaceId: string | undefined): boolean
}

export interface ControlWithoutPushed extends ControlBase<any> {
	readonly supportsPushed: false
}
