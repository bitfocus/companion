import { ConfigValue } from './config.js'

export type InputValue = number | string | boolean

export type SomeCompanionInputField =
	| CompanionInputFieldText
	| CompanionInputFieldColor
	| CompanionInputFieldTextInput
	| CompanionInputFieldTextWithVariablesInput
	| CompanionInputFieldDropdown
	| CompanionInputFieldMultiDropdown
	| CompanionInputFieldNumber
	| CompanionInputFieldCheckbox

export interface CompanionInputField {
	id: string
	type: 'text' | 'textinput' | 'textwithvariables' | 'dropdown' | 'colorpicker' | 'number' | 'checkbox'
	label: string
	tooltip?: string
	isVisible?: (options: { [key: string]: InputValue | undefined }) => boolean
}
export interface CompanionInputFieldText extends CompanionInputField {
	type: 'text'
	value: string
}
export interface CompanionInputFieldColor extends CompanionInputField {
	type: 'colorpicker'
	default: number
}
export interface CompanionInputFieldTextInput extends CompanionInputField {
	type: 'textinput'
	regex?: string
	default?: string
	required?: boolean
}

export interface CompanionInputFieldTextWithVariablesInput extends CompanionInputField {
	type: 'textwithvariables'
	default?: string
}

export interface DropdownChoice {
	id: ConfigValue
	label: string
}
export interface CompanionInputFieldDropdown extends CompanionInputFieldDropdownBase {
	multiple?: false
	default: ConfigValue

	/** Allow custom values to be defined */
	allowCustom?: boolean
	/** Check custom value against regex */
	regex?: string
}
export interface CompanionInputFieldMultiDropdown extends CompanionInputFieldDropdownBase {
	multiple: true
	default: ConfigValue[]

	/** The minimum number of selected values */
	minSelection?: number
	/** The maximum number of selected values */
	maximumSelectionLength?: number
}
export interface CompanionInputFieldDropdownBase extends CompanionInputField {
	type: 'dropdown'
	// default: ConfigValue
	choices: DropdownChoice[]

	multiple?: boolean

	/** The minimum number of entries the dropdown must have before it allows searching */
	minChoicesForSearch?: number
}
export interface CompanionInputFieldCheckbox extends CompanionInputField {
	type: 'checkbox'
	default: boolean
}
export interface CompanionInputFieldNumber extends CompanionInputField {
	type: 'number'
	min: number
	max: number
	step?: number
	range?: boolean
	required?: boolean
	default: number
}

export type EncodeIsVisible<T extends SomeCompanionInputField> = Omit<T, 'isVisible'> & {
	isVisibleFn?: string
}
export type SomeEncodedCompanionInputField = EncodeIsVisible<SomeCompanionInputField>
