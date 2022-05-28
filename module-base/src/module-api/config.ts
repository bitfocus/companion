import { CompanionInputFieldBase, SomeCompanionInputField } from './input.js'

/**
 * A configuration input field
 */
export interface CompanionConfigField extends CompanionInputFieldBase {
	width: number
}

/**
 * Some configuration input field
 */
export type SomeCompanionConfigField = SomeCompanionInputField & CompanionConfigField
