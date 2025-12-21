import type { DropdownChoice, DropdownChoiceId } from './Common.js'

export type CompanionColorPresetValue =
	| string
	| {
			color: string
			title: string
	  }
export interface CompanionFieldVariablesSupport {
	/** Whether to include local variables */
	local?: boolean
}

export interface CompanionInputFieldBaseExtended {
	/** The unique id of this input field within the input group */
	id: string
	/** The type of this input field */
	type:
		| 'static-text'
		| 'textinput'
		| 'dropdown'
		| 'multidropdown'
		| 'colorpicker'
		| 'number'
		| 'checkbox'
		| 'custom-variable'
		| 'bonjour-device'
		| 'secret-text'
		| 'internal:time'
		| 'internal:date'
		| 'internal:variable'
		| 'internal:custom_variable'
		| 'internal:trigger'
		| 'internal:trigger_collection'
		| 'internal:connection_id'
		| 'internal:connection_collection'
		| 'internal:surface_serial'
		| 'internal:page'
		| 'internal:horizontal-alignment'
		| 'internal:vertical-alignment'
		| 'internal:png-image'
	/** The label of the field */
	label: string
	/** A hover tooltip for this field */
	tooltip?: string
	/** A description for this field */
	description?: string

	isVisibleUi?: IsVisibleUiFn

	width?: number // For connection config
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
	supportsLocal: boolean
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
export interface InternalInputFieldConnectionCollection extends CompanionInputFieldBaseExtended {
	type: 'internal:connection_collection'
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
export interface InternalInputFieldHorizontalAlignment extends CompanionInputFieldBaseExtended {
	type: 'internal:horizontal-alignment'
	/** The default value */
	default: 'left' | 'center' | 'right'
}
export interface InternalInputFieldVerticalAlignment extends CompanionInputFieldBaseExtended {
	type: 'internal:vertical-alignment'
	/** The default value */
	default: 'top' | 'center' | 'bottom'
}
export interface InternalInputFieldPngImage extends CompanionInputFieldBaseExtended {
	type: 'internal:png-image'
	/** The default value */
	default: string | null
	/** Minimum image dimensions */
	min?: { width: number; height: number }
	/** Maximum image dimensions */
	max?: { width: number; height: number }
	/** Allow non-PNG image formats */
	allowNonPng?: boolean
}

export type InternalInputField =
	| InternalInputFieldTime
	| InternalInputFieldDate
	| InternalInputFieldVariable
	| InternalInputFieldCustomVariable
	| InternalInputFieldTrigger
	| InternalInputFieldTriggerCollection
	| InternalInputFieldConnectionId
	| InternalInputFieldConnectionCollection
	| InternalInputFieldSurfaceSerial
	| InternalInputFieldPage
	| InternalInputFieldHorizontalAlignment
	| InternalInputFieldVerticalAlignment
	| InternalInputFieldPngImage

export interface CompanionInputFieldStaticTextExtended extends CompanionInputFieldBaseExtended {
	type: 'static-text'

	value: string
	default?: never
}
export interface CompanionInputFieldColorExtended extends CompanionInputFieldBaseExtended {
	type: 'colorpicker'

	default: string | number
	enableAlpha: boolean
	returnType: 'string' | 'number'

	presetColors?: CompanionColorPresetValue[]
}
export interface CompanionInputFieldTextInputExtended extends CompanionInputFieldBaseExtended {
	type: 'textinput'

	default?: string
	required?: boolean

	regex?: string

	useVariables?: CompanionFieldVariablesSupport

	placeholder?: string
	/** A UI hint indicating the field is an expression */
	isExpression?: boolean
	multiline?: boolean
}
export interface CompanionInputFieldDropdownExtended extends CompanionInputFieldBaseExtended {
	type: 'dropdown'
	choices: DropdownChoice[]
	default: DropdownChoiceId
	allowCustom?: boolean
	regex?: string
	minChoicesForSearch?: number
}
export interface CompanionInputFieldMultiDropdownExtended extends CompanionInputFieldBaseExtended {
	type: 'multidropdown'
	/** The possible choices */
	choices: DropdownChoice[]
	/** The default selected values */
	default: DropdownChoiceId[]
	/** The minimum number of entries the dropdown must have before it allows searching */
	minChoicesForSearch?: number
	/** The minimum number of selected values */
	minSelection?: number
	/** The maximum number of selected values */
	maxSelection?: number

	allowCustom?: boolean
	regex?: string
}
export interface CompanionInputFieldNumberExtended extends CompanionInputFieldBaseExtended {
	type: 'number'
	/** The default value */
	default: number
	/**
	 * Whether a value is required
	 * Note: values may not conform to this, it is a visual hint only
	 */
	required?: boolean
	/**
	 * The minimum value to allow
	 * Note: values may not conform to this, it is a visual hint only
	 */
	min: number
	/**
	 * The maximum value to allow
	 * Note: values may not conform to this, it is a visual hint only
	 */
	max: number
	/** The stepping of the arrows */
	step?: number
	/** Whether to show a slider for the input */
	range?: boolean
	/** When true, show the min value as a visual -∞ when value <= min */
	showMinAsNegativeInfinity?: boolean
	/** When true, show the max value as a visual ∞ when value >= max */
	showMaxAsPositiveInfinity?: boolean
}
export interface CompanionInputFieldCheckboxExtended extends CompanionInputFieldBaseExtended {
	type: 'checkbox'
	/** The default value */
	default: boolean
}
export interface CompanionInputFieldCustomVariableExtended extends CompanionInputFieldBaseExtended {
	type: 'custom-variable'
	default?: never // needed to avoid TypeScript errors (all other input fields have default props)
}

export type ExtendedInputField =
	| CompanionInputFieldStaticTextExtended
	| CompanionInputFieldColorExtended
	| CompanionInputFieldTextInputExtended
	| CompanionInputFieldDropdownExtended
	| CompanionInputFieldMultiDropdownExtended
	| CompanionInputFieldNumberExtended
	| CompanionInputFieldCheckboxExtended
	| CompanionInputFieldCustomVariableExtended

export interface CompanionInputFieldBonjourDeviceExtended extends CompanionInputFieldBaseExtended {
	type: 'bonjour-device'
}
export interface CompanionInputFieldSecretExtended extends CompanionInputFieldBaseExtended {
	type: 'secret-text'
	/**
	 * The default text value
	 */
	default?: string
	/**
	 * Whether a value is required
	 * Note: values may not conform to this, it is a visual hint only
	 */
	required?: boolean

	regex?: string
}
export type SomeCompanionConfigInputField = CompanionInputFieldBonjourDeviceExtended | CompanionInputFieldSecretExtended

export interface IsVisibleUiFn {
	type: 'function' | 'expression'
	fn: string
	data?: any
}

export type SomeCompanionInputField = ExtendedInputField | SomeCompanionConfigInputField | InternalInputField
