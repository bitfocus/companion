import z from 'zod'
import type { ActionSetId } from './ActionModel.js'
import type { ButtonStyleProperties } from './StyleModel.js'
import {
	ExpressionableOptionsObjectSchema,
	createExpressionOrValueSchema,
	type ExpressionableOptionsObject,
	type ExpressionOrValue,
} from './Options.js'
import type { VariableValue } from './Variables.js'
import type { CompanionFeedbackButtonStyleResult } from '@companion-module/host'

export type SomeEntityModel = ActionEntityModel | FeedbackEntityModel
export type SomeReplaceableEntityModel = ReplaceableActionEntityModel | ReplaceableFeedbackEntityModel
export type ReplaceableActionEntityModel = Pick<
	ActionEntityModel,
	'id' | 'type' | 'definitionId' | 'options' | 'upgradeIndex'
>
export type ReplaceableFeedbackEntityModel = Pick<
	FeedbackEntityModel,
	'id' | 'type' | 'definitionId' | 'style' | 'options' | 'isInverted' | 'upgradeIndex'
>

export enum EntityModelType {
	Action = 'action',
	Feedback = 'feedback',
}

export enum FeedbackEntitySubType {
	Boolean = 'boolean',
	Advanced = 'advanced',
	Value = 'value',
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
	isInverted?: ExpressionOrValue<boolean>
	/** If in a list that produces local-variables, this entity value will be exposed under this name */
	variableName?: string
	/** When in a list that supports advanced feedbacks, this style can be set */
	style?: Partial<ButtonStyleProperties>
}

export interface EntityModelBase {
	readonly type: EntityModelType

	id: string
	definitionId: string
	connectionId: string
	headline?: string
	options: ExpressionableOptionsObject
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
	feedbackListType?: FeedbackEntitySubType.Boolean | FeedbackEntitySubType.Value

	/**
	 * Limit the maximum number of direct children in this group.
	 */
	maximumChildren?: number
}

export type FeedbackValue = CompanionFeedbackButtonStyleResult | VariableValue

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

const zodEntityModelBase = z.object({
	id: z.string(),
	definitionId: z.string(),
	connectionId: z.string(),
	headline: z.string().optional(),
	options: ExpressionableOptionsObjectSchema,
	disabled: z.boolean().optional(),
	upgradeIndex: z.union([z.number(), z.undefined()]),
})

export const zodSomeEntityModel: z.ZodType<SomeEntityModel> = z.lazy(() =>
	z.union([
		zodEntityModelBase.extend({
			type: z.literal(EntityModelType.Action),
			children: z.record(z.string(), z.array(zodSomeEntityModel).optional()).optional(),
		}),
		zodEntityModelBase.extend({
			type: z.literal(EntityModelType.Feedback),
			isInverted: createExpressionOrValueSchema(z.boolean()).optional(),
			variableName: z.string().optional(),
			style: z.record(z.string(), z.any()).optional(),
			children: z.record(z.string(), z.array(zodSomeEntityModel).optional()).optional(),
		}),
	])
)
