import type { ControlBase } from './ControlBase.js'
import type { ControlEntityListPoolBase } from './Entities/EntityListPoolBase.js'
import type { ControlActionSetAndStepsManager } from './Entities/ControlActionSetAndStepsManager.js'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import type { ButtonGraphicsElementUsage, ButtonStyleProperties } from '@companion-app/shared/Model/StyleModel.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'

export type SomeControl<TJson> = ControlBase<TJson> &
	(ControlWithLayeredStyle | ControlWithoutLayeredStyle) &
	(ControlWithEntities | ControlWithoutEntities) &
	(ControlWithActions | ControlWithoutActions) &
	(ControlWithEvents | ControlWithoutEvents) &
	(ControlWithActionSets | ControlWithoutActionSets) &
	(ControlWithOptions | ControlWithoutOptions) &
	(ControlWithPushed | ControlWithoutPushed)

export interface ControlWithoutLayeredStyle extends ControlBase<any> {
	readonly supportsLayeredStyle: false
}

export interface ControlWithLayeredStyle extends ControlBase<any> {
	readonly supportsLayeredStyle: true

	/**
	 * Add an element to the layered style
	 * @param type Element type to add
	 * @param index Index to insert the element at, or null to append
	 */
	layeredStyleAddElement(type: string, index: number | null): string

	/**
	 * Remove an element from the layered style
	 * @param id Element id to remove
	 * @returns true if the element was removed
	 */
	layeredStyleRemoveElement(id: string): boolean

	/**
	 * Move an element in the layered style
	 * @param id Element id to move
	 * @param parentElementId Parent element id to move the element to
	 * @param newIndex New index of the element
	 * @returns true if the element was moved
	 */
	layeredStyleMoveElement(id: string, parentElementId: string | null, newIndex: number): boolean

	/**
	 * Update the name of an element in the layered style
	 * @param id Element id to update
	 * @param name New name for the element
	 * @returns true if the element was updated
	 */
	layeredStyleSetElementName(id: string, name: string): boolean

	/**
	 * Update the usage of an element in the layered style
	 * @param id Element id to update
	 * @param usage New usage for the element
	 * @returns true if the element was updated
	 */
	layeredStyleSetElementUsage(id: string, name: ButtonGraphicsElementUsage): boolean

	/**
	 * Update an option on an element from the layered style
	 * @param id Element id to update
	 * @param key Option key to update
	 * @param value New value for the option
	 * @returns true if any changes were made
	 */
	layeredStyleUpdateOptionValue(id: string, key: string, value: any): boolean

	/**
	 * Update whether option on an element from the layered style is an expression
	 * @param id Element id to update
	 * @param key Option key to update
	 * @param value Whether the value should be an expression
	 * @returns true if any changes were made
	 */
	layeredStyleUpdateOptionIsExpression(id: string, key: string, value: boolean): boolean

	/**
	 * Update the style from legacy properties
	 * Future: Once the old button style is removed, this should be reworked to utilise the new style system better
	 * @param diff The properties to update
	 * @returns true if any changes were made
	 */
	layeredStyleUpdateFromLegacyProperties(diff: Partial<ButtonStyleProperties>): boolean

	/**
	 * Propagate variable changes
	 * @param allChangedVariables - variables with changes
	 */
	onVariablesChanged(allChangedVariables: Set<string>): void

	/**
	 * Get an element from the layered style by ID
	 * @param id Element ID to find
	 * @returns The element if found, undefined otherwise
	 */
	layeredStyleGetElementById(id: string): SomeButtonGraphicsElement | undefined

	/**
	 * Get the selected element IDs for each usage in the layered style
	 */
	layeredStyleSelectedElementIds(): { [usage in ButtonGraphicsElementUsage]: string | undefined }
}

export interface ControlWithEntities extends ControlBase<any> {
	readonly supportsEntities: true

	readonly entities: ControlEntityListPoolBase
}

export interface ControlWithoutEntities extends ControlBase<any> {
	readonly supportsEntities: false
}

export interface ControlWithActions extends ControlBase<any> {
	readonly supportsActions: true

	/**
	 * Abort in progress action runs for a control
	 * @param skip_up Mark button as released
	 */
	abortDelayedActions(skip_up: boolean, exceptSignal: AbortSignal | null): void

	/**
	 * Abort a single action run for a control
	 * @param skip_up Mark button as released
	 */
	abortDelayedActionsSingle(skip_up: boolean, exceptSignal: AbortSignal): void
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

	readonly actionSets: ControlActionSetAndStepsManager

	/**
	 * Execute a rotate of this control
	 * @param rightward Whether the control was rotated to the right
	 * @param surfaceId The surface that initiated this rotate
	 */
	rotateControl(rightward: boolean, surfaceId: string | undefined): void
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
