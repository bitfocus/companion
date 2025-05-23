import { ActionSetId } from './ActionModel.js'
import type { ButtonStyleProperties } from './StyleModel.js'

export type SomeEntityModel = ActionEntityModel | FeedbackEntityModel
export type SomeReplaceableEntityModel =
	| Pick<ActionEntityModel, 'id' | 'type' | 'definitionId' | 'options'>
	| Pick<FeedbackEntityModel, 'id' | 'type' | 'definitionId' | 'style' | 'options' | 'isInverted'>

export enum EntityModelType {
	Action = 'action',
	Feedback = 'feedback',
}

export interface ActionEntityModel extends EntityModelBase {
	readonly type: EntityModelType.Action
}

export interface FeedbackEntityModel extends EntityModelBase {
	readonly type: EntityModelType.Feedback

	isInverted?: boolean
	style?: Partial<ButtonStyleProperties>
}

export interface EntityModelBase {
	readonly type: EntityModelType

	id: string
	definitionId: string
	connectionId: string
	headline?: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex?: number

	/**
	 * Some internal entities can have children, one or more set of them
	 */
	children?: Record<string, SomeEntityModel[] | undefined>
}

export interface EntityOwner {
	parentId: string
	childGroup: string
}

export interface EntitySupportedChildGroupDefinition {
	type: EntityModelType
	groupId: string
	/** Display type of the entity (eg condition, feedback or action) */
	entityTypeLabel: string
	label: string
	hint?: string

	/** Only valid for feedback entities */
	booleanFeedbacksOnly?: boolean
}

// TODO: confirm this is sensible
export type SomeSocketEntityLocation =
	// | 'trigger_events'
	| 'feedbacks'
	| 'trigger_actions'
	| {
			// button actions
			stepId: string
			setId: ActionSetId
	  }

export function stringifySocketEntityLocation(location: SomeSocketEntityLocation): string {
	if (typeof location === 'string') return location
	return `${location.stepId}_${location.setId}`
}
