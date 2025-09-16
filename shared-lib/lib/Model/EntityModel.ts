import z from 'zod'
import { ActionSetId } from './ActionModel.js'
import type { ButtonStyleProperties } from './StyleModel.js'
import { ExpressionOrValue, schemaExpressionOrValue } from './StyleLayersModel.js'

export type SomeEntityModel = ActionEntityModel | FeedbackEntityModel
export type SomeReplaceableEntityModel =
	| Pick<ActionEntityModel, 'id' | 'type' | 'definitionId' | 'options' | 'upgradeIndex'>
	| Pick<FeedbackEntityModel, 'id' | 'type' | 'definitionId' | 'style' | 'options' | 'isInverted' | 'upgradeIndex'>

export enum EntityModelType {
	Action = 'action',
	Feedback = 'feedback',
}

export enum FeedbackEntitySubType {
	Boolean = 'boolean',
	Advanced = 'advanced',
	Value = 'value',
	StyleOverride = 'style-override',
}

export function isValidFeedbackEntitySubType(value: FeedbackEntitySubType | string): value is FeedbackEntitySubType {
	return Object.values(FeedbackEntitySubType).includes(value as any)
}

export function isInternalUserValueFeedback(entity: EntityModelBase): boolean {
	return (
		entity.type === EntityModelType.Feedback &&
		entity.connectionId === 'internal' &&
		entity.definitionId === 'user_value'
	)
}

export interface ActionEntityModel extends EntityModelBase {
	readonly type: EntityModelType.Action
}

export interface FeedbackEntityModel extends EntityModelBase {
	readonly type: EntityModelType.Feedback

	/** Boolean feedbacks can be inverted */
	isInverted?: boolean
	/** If in a list that produces local-variables, this entity value will be exposed under this name */
	variableName?: string
	/** When in a list that supports advanced feedbacks, this style can be set */
	style?: Partial<ButtonStyleProperties>

	/** When in a style list on a layered button, some overrides to apply */
	styleOverrides?: FeedbackEntityStyleOverride[]
}

export interface FeedbackEntityStyleOverride {
	overrideId: string
	elementId: string
	elementProperty: string
	override: ExpressionOrValue<any>
}
export const schemaFeedbackEntityStyleOverride: z.ZodType<FeedbackEntityStyleOverride> = z.object({
	overrideId: z.string(),
	elementId: z.string(),
	elementProperty: z.string(),
	override: schemaExpressionOrValue,
})

export interface EntityModelBase {
	readonly type: EntityModelType

	id: string
	definitionId: string
	connectionId: string
	headline?: string
	options: Record<string, any>
	disabled?: boolean
	upgradeIndex: number | undefined

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
	feedbackListType?: FeedbackEntitySubType.Boolean | FeedbackEntitySubType.Value | FeedbackEntitySubType.StyleOverride

	/**
	 * Limit the maximum number of direct children in this group.
	 */
	maximumChildren?: number
}

const zodActionSetId: z.ZodSchema<ActionSetId> = z.union([
	z.literal('down'),
	z.literal('up'),
	z.literal('rotate_left'),
	z.literal('rotate_right'),
	z.number(),
])

export const zodEntityLocation = z.union([
	z.literal('feedbacks'),
	z.literal('trigger_actions'),
	z.literal('local-variables'),
	z.object({
		stepId: z.string(),
		setId: zodActionSetId,
	}),
])

export type SomeSocketEntityLocation = z.infer<typeof zodEntityLocation>

export function stringifySocketEntityLocation(location: SomeSocketEntityLocation): string {
	if (typeof location === 'string') return location
	return `${location.stepId}_${location.setId}`
}
