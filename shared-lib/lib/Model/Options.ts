import type {
	CompanionInputFieldBase,
	CompanionInputFieldBonjourDevice,
	CompanionInputFieldCheckbox,
	CompanionInputFieldColor,
	CompanionInputFieldCustomVariable,
	CompanionInputFieldDropdown,
	CompanionInputFieldMultiDropdown,
	CompanionInputFieldNumber,
	CompanionInputFieldSecret,
	CompanionInputFieldStaticText,
	CompanionInputFieldTextInput,
} from '@companion-module/base'

// TODO: move to '@companion-module/base'
export type IsVisibleFunction = Required<CompanionInputFieldBase>['isVisible']

export type InternalInputFieldType =
	| 'internal:time'
	| 'internal:date'
	| 'internal:variable'
	| 'internal:custom_variable'
	| 'internal:trigger'
	| 'internal:trigger_collection'
	| 'internal:connection_id'
	| 'internal:surface_serial'
	| 'internal:page'
// export type CompanionInputFieldTypeExtended = CompanionInputFieldBase['type']
export interface CompanionInputFieldBaseExtended extends Omit<CompanionInputFieldBase, 'type'> {
	type: InternalInputFieldType
}

export interface InternalInputFieldTime extends CompanionInputFieldBaseExtended {
	type: 'internal:time'
}
export interface InternalInputFieldDate extends CompanionInputFieldBaseExtended {
	type: 'internal:date'
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
	includeSelf?: boolean | 'abort'
	default?: string
}
export interface InternalInputFieldTriggerCollection extends CompanionInputFieldBaseExtended {
	type: 'internal:trigger_collection'
	default?: string
}
export interface InternalInputFieldConnectionId extends CompanionInputFieldBaseExtended {
	type: 'internal:connection_id'
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
	includeStartup: boolean
	includeDirection: boolean
	default: number
}

export type InternalInputField =
	| EncodeIsVisible2<InternalInputFieldTime>
	| EncodeIsVisible2<InternalInputFieldDate>
	| EncodeIsVisible2<InternalInputFieldVariable>
	| EncodeIsVisible2<InternalInputFieldCustomVariable>
	| EncodeIsVisible2<InternalInputFieldTrigger>
	| EncodeIsVisible2<InternalInputFieldTriggerCollection>
	| EncodeIsVisible2<InternalInputFieldConnectionId>
	| EncodeIsVisible2<InternalInputFieldSurfaceSerial>
	| EncodeIsVisible2<InternalInputFieldPage>

export interface CompanionInputFieldTextInputExtended extends CompanionInputFieldTextInput {
	placeholder?: string
	/** A UI hint indicating the field is an expression */
	isExpression?: boolean
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

export type ExtendedConfigField =
	| EncodeIsVisible2<CompanionInputFieldBonjourDevice>
	| EncodeIsVisible2<CompanionInputFieldSecret>

export type EncodeIsVisible2<T extends Pick<CompanionInputFieldBase, 'id' | 'isVisible'>> = Omit<
	T,
	'isVisible' | 'isVisibleData' | 'isVisibleExpression'
> & {
	isVisibleUi?: {
		type: 'function' | 'expression'
		fn: string
		data?: any
	}
}

export type ConnectionInputField = ExtendedInputField | ExtendedConfigField
export type InternalActionInputField = ExtendedInputField | InternalInputField
export type InternalFeedbackInputField = ExtendedInputField | InternalInputField
