import type {
	CompanionButtonStyleProps,
	CompanionInputFieldBase,
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

export type EncodeIsVisible2<T extends Pick<CompanionInputFieldBase, 'id' | 'isVisible'>> = Omit<T, 'isVisible'> & {
	isVisibleFn?: string
}

export type InternalActionInputField = SomeCompanionActionInputField | InternalInputField
export type InternalFeedbackInputField = SomeCompanionFeedbackInputField | InternalInputField

export interface ActionDefinition {
	label: string
	description: string | undefined
	options: EncodeIsVisible2<InternalActionInputField>[]
	hasLearn?: boolean
}

export interface FeedbackDefinition {
	label: string
	description: string | undefined
	options: EncodeIsVisible2<InternalFeedbackInputField>[]
	type: 'advanced' | 'boolean'
	style: Partial<CompanionButtonStyleProps> | undefined
	hasLearn: boolean
	showInvert: boolean
}

export interface InternalFeedbackDefinition extends FeedbackDefinition {
	showButtonPreview?: boolean
}

export interface InternalActionDefinition extends Omit<ActionDefinition, 'options'> {
	showButtonPreview?: boolean
	options: InternalActionInputField[]
}

export interface ClientActionDefinition extends Omit<InternalActionDefinition, 'options'> {
	options: EncodeIsVisible2<InternalActionInputField>[]
}
