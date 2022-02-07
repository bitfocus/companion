import { ConfigValue } from './config.js';

export type InputValue = number | string | boolean;

export type SomeCompanionInputField =
	| CompanionInputFieldText
	| CompanionInputFieldColor
	| CompanionInputFieldTextInput
	| CompanionInputFieldDropdown
	| CompanionInputFieldNumber
	| CompanionInputFieldCheckbox;

export interface CompanionInputField {
	id: string;
	type: 'text' | 'textinput' | 'dropdown' | 'colorpicker' | 'number' | 'checkbox'; // TODO - multiselect
	label: string;
	tooltip?: string;
}
export interface CompanionInputFieldText extends CompanionInputField {
	type: 'text';
	value: string;
}
export interface CompanionInputFieldColor extends CompanionInputField {
	type: 'colorpicker';
	default: number;
}
export interface CompanionInputFieldTextInput extends CompanionInputField {
	type: 'textinput';
	regex?: string;
	default?: string;
	required?: boolean;
}

export interface DropdownChoice {
	id: ConfigValue;
	label: string;
}
export interface CompanionInputFieldDropdown extends CompanionInputField {
	type: 'dropdown';
	default: ConfigValue | ConfigValue[];
	choices: DropdownChoice[];

	multiple: boolean;

	minChoicesForSearch?: number;
	minSelection?: number;
	maximumSelectionLength?: number;
}
export interface CompanionInputFieldCheckbox extends CompanionInputField {
	type: 'checkbox';
	default: boolean;
}
export interface CompanionInputFieldNumber extends CompanionInputField {
	type: 'number';
	min: number;
	max: number;
	step?: number;
	range?: boolean;
	required?: boolean;
	default: number;
}
