import type {
	CompanionButtonStyleProps,
	SomeCompanionActionInputField,
	SomeCompanionFeedbackInputField,
} from '@companion-module/base'

export type InternalInputField = (
	| {
			type: 'internal:time'
	  }
	| {
			type: 'internal:variable'
			default: string
	  }
	| {
			type: 'internal:custom_variable'
			includeNone?: boolean
	  }
	| {
			type: 'internal:trigger'
			includeSelf?: boolean
			default?: string
	  }
	| {
			type: 'internal:instance_id'
			multiple: boolean
			includeAll?: boolean
			filterActionsRecorder?: boolean
			default?: string[]
	  }
	| {
			type: 'internal:surface_serial'
			includeSelf: boolean
			default: string
	  }
	| {
			type: 'internal:page'
			includeDirection: boolean
			default: number
	  }
	| {
			type: 'internal:variable'
	  }
) &
	Omit<import('@companion-module/base').CompanionInputFieldBase, 'type'>

export type InternalActionInputField = SomeCompanionActionInputField | InternalInputField
export type InternalFeedbackInputField = SomeCompanionFeedbackInputField | InternalInputField

export interface ActionDefinition {
	label: string
	description: string | undefined
	options: InternalActionInputField[]
	hasLearn?: boolean
}

export interface FeedbackDefinition {
	label: string
	description: string | undefined
	options: InternalFeedbackInputField[]
	type: 'advanced' | 'boolean'
	style: Partial<CompanionButtonStyleProps> | undefined
	hasLearn: boolean
	showInvert: boolean
}

export interface InternalFeedbackDefinition extends FeedbackDefinition {
	showButtonPreview?: boolean
}

export interface InternalActionDefinition extends ActionDefinition {
	showButtonPreview?: boolean
}
