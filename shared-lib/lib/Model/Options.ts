import type {
	CompanionButtonStyleProps,
	CompanionInputFieldBase,
	CompanionInputFieldCheckbox,
	CompanionInputFieldColor,
	CompanionInputFieldCustomVariable,
	CompanionInputFieldDropdown,
	CompanionInputFieldMultiDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldStaticText,
	CompanionInputFieldTextInput,
} from '@companion-module/base'
import type { SetOptional } from 'type-fest'

// TODO: move to '@companion-module/base'
export type IsVisibleFunction = Required<CompanionInputFieldBase>['isVisible']

export type InternalInputFieldType =
	| 'internal:time'
	| 'internal:variable'
	| 'internal:custom_variable'
	| 'internal:trigger'
	| 'internal:instance_id'
	| 'internal:surface_serial'
	| 'internal:page'
// export type CompanionInputFieldTypeExtended = CompanionInputFieldBase['type']
export interface CompanionInputFieldBaseExtended extends Omit<CompanionInputFieldBase, 'type'> {
	type: InternalInputFieldType
}

export interface InternalInputFieldTime extends CompanionInputFieldBaseExtended {
	type: 'internal:time'
}
export interface InternalInputFieldVariable extends CompanionInputFieldBaseExtended {
	type: 'internal:variable'
	// default: string
}
export interface InternalInputFieldCustomVariable extends CompanionInputFieldBaseExtended {
	type: 'internal:custom_variable'
	includeNone?: boolean
}
export interface InternalInputFieldTrigger extends CompanionInputFieldBaseExtended {
	type: 'internal:trigger'
	includeSelf?: boolean
	default?: string
}
export interface InternalInputFieldInstanceId extends CompanionInputFieldBaseExtended {
	type: 'internal:instance_id'
	multiple: boolean
	includeAll?: boolean
	filterActionsRecorder?: boolean
	default?: string[]
}
export interface InternalInputFieldSurfaceSerial extends CompanionInputFieldBaseExtended {
	type: 'internal:surface_serial'
	includeSelf: boolean
	default: string
	useRawSurfaces?: boolean
}
export interface InternalInputFieldPage extends CompanionInputFieldBaseExtended {
	type: 'internal:page'
	includeDirection: boolean
	default: number
}

export type InternalInputField =
	| EncodeIsVisible2<InternalInputFieldTime>
	| EncodeIsVisible2<InternalInputFieldVariable>
	| EncodeIsVisible2<InternalInputFieldCustomVariable>
	| EncodeIsVisible2<InternalInputFieldTrigger>
	| EncodeIsVisible2<InternalInputFieldInstanceId>
	| EncodeIsVisible2<InternalInputFieldSurfaceSerial>
	| EncodeIsVisible2<InternalInputFieldPage>

export interface CompanionInputFieldTextInputExtended extends CompanionInputFieldTextInput {
	placeholder?: string
	useInternalLocationVariables?: boolean
}
export interface CompanionInputFieldMultiDropdownExtended extends CompanionInputFieldMultiDropdown {
	allowCustom?: boolean
	regex?: string
}

export type ExtendedInputField =
	| EncodeIsVisible2<CompanionInputFieldStaticText>
	| EncodeIsVisible2<CompanionInputFieldColor>
	| EncodeIsVisible2<CompanionInputFieldTextInputExtended>
	| EncodeIsVisible2<CompanionInputFieldDropdown>
	| EncodeIsVisible2<CompanionInputFieldMultiDropdownExtended>
	| EncodeIsVisible2<CompanionInputFieldNumber>
	| EncodeIsVisible2<CompanionInputFieldCheckbox>
	| EncodeIsVisible2<CompanionInputFieldCustomVariable>

export type EncodeIsVisible2<T extends Pick<CompanionInputFieldBase, 'id' | 'isVisible'>> = Omit<T, 'isVisible'> & {
	isVisibleFn?: string
}

export type InternalActionInputField = ExtendedInputField | InternalInputField
export type InternalFeedbackInputField = ExtendedInputField | InternalInputField

export interface ActionDefinition {
	label: string
	description: string | undefined
	options: InternalActionInputField[]
	hasLearn: boolean
	learnTimeout: number | undefined
}

export interface FeedbackDefinition {
	label: string
	description: string | undefined
	options: InternalFeedbackInputField[]
	type: 'advanced' | 'boolean'
	style: Partial<CompanionButtonStyleProps> | undefined
	hasLearn: boolean
	learnTimeout: number | undefined
	showInvert: boolean
}

export interface InternalFeedbackDefinition extends SetOptional<FeedbackDefinition, 'hasLearn' | 'learnTimeout'> {
	showButtonPreview?: boolean
}

export interface InternalActionDefinition
	extends SetOptional<Omit<ActionDefinition, 'options'>, 'hasLearn' | 'learnTimeout'> {
	showButtonPreview?: boolean
	options: InternalActionInputField[]
}

export interface ClientActionDefinition extends InternalActionDefinition {}
