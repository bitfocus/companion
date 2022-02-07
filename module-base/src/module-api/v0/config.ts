import { CompanionInputField, SomeCompanionInputField } from './input.js';

export type ConfigValue = string | number;

export interface CompanionConfigField extends CompanionInputField {
	width: number;
}
export type SomeCompanionConfigField = SomeCompanionInputField & CompanionConfigField;
