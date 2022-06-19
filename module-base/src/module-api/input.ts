export type InputValue = number | string | boolean

export type SomeCompanionInputField =
	| CompanionInputFieldStaticText
	| CompanionInputFieldColor
	| CompanionInputFieldTextInput
	| CompanionInputFieldDropdown
	| CompanionInputFieldMultiDropdown
	| CompanionInputFieldNumber
	| CompanionInputFieldCheckbox

/**
 * The common properties for an input field
 */
export interface CompanionInputFieldBase {
	/** The unique id of this input field */
	id: string
	/** The type of this input field */
	type: 'static-text' | 'textinput' | 'dropdown' | 'multidropdown' | 'colorpicker' | 'number' | 'checkbox'
	/** The label of the field */
	label: string
	/** A hover tooltop for this field */
	tooltip?: string
	/** A function called to check whether this input should be visible, based on the current options selections */
	isVisible?: (options: { [key: string]: InputValue | undefined }) => boolean
}

/**
 * A static un-editable line of text
 */
export interface CompanionInputFieldStaticText extends CompanionInputFieldBase {
	type: 'static-text'
	/** The text to show */
	value: string
}

/**
 * A colour picker input
 */
export interface CompanionInputFieldColor extends CompanionInputFieldBase {
	type: 'colorpicker'
	/**
	 * The default color value
	 */
	default: number
}

/**
 * A basic text input field
 */
export interface CompanionInputFieldTextInput extends CompanionInputFieldBase {
	type: 'textinput'
	/**
	 * The default text value
	 */
	default?: string
	/**
	 * Whether a value is required
	 * Note: values may not conform to this, it is a visual hint only
	 */
	required?: boolean
	/**
	 * A regex to use to inform the user if the current input is valid.
	 * Note: values may not conform to this, it is a visual hint only
	 */
	regex?: string
	/**
	 * Whether to suggest variables to the user
	 * TODO: If enabled, the value will have variables parsed before execution
	 * TODO: Is this sensible, because of regex?
	 */
	// useVariables?: boolean
}

export type DropdownChoiceId = string | number
/**
 * An option for a dropdown input
 */
export interface DropdownChoice {
	/** Value of the option */
	id: DropdownChoiceId
	/** Label to show to users */
	label: string
}

/**
 * A dropdown input field
 */
export interface CompanionInputFieldDropdown extends CompanionInputFieldBase {
	type: 'dropdown'

	/** The possible choices */
	choices: DropdownChoice[]

	/** The default selected value */
	default: DropdownChoiceId

	/** Allow custom values to be defined */
	allowCustom?: boolean
	/** Check custom value against regex */
	regex?: string

	/** The minimum number of entries the dropdown must have before it allows searching */
	minChoicesForSearch?: number
}

/**
 * A multi-select dropdown input field
 */
export interface CompanionInputFieldMultiDropdown extends CompanionInputFieldBase {
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
	maximumSelectionLength?: number
}

/**
 * A checkbox input field
 */
export interface CompanionInputFieldCheckbox extends CompanionInputFieldBase {
	type: 'checkbox'
	/** The default value */
	default: boolean
}

/**
 * A number input field
 */
export interface CompanionInputFieldNumber extends CompanionInputFieldBase {
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
}
