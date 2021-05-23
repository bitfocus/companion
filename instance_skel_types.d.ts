/// <reference types="node" />
import { EventEmitter } from 'events'

export interface CompanionSystem extends EventEmitter {}

export type InputValue = number | string | boolean

export type CompanionBank = CompanionBankPage | CompanionBankPNG | CompanionBankPreset

export interface CompanionBankPage {
	style: 'pageup' | 'pagedown' | 'pagenum'
}

export type CompanionAlignment =
	| 'left:top'
	| 'center:top'
	| 'right:top'
	| 'left:center'
	| 'center:center'
	| 'right:center'
	| 'left:bottom'
	| 'center:bottom'
	| 'right:bottom'

export type CompanionTextSize = 'auto' | '7' | '14' | '18' | '24' | '30' | '44'

export interface CompanionBankRequiredProps {
	text: string
	size: CompanionTextSize
	color: number
	bgcolor: number
}
export interface CompanionBankAdditionalStyleProps {
	alignment: CompanionAlignment
	pngalignment: CompanionAlignment
	png64?: string
}
export interface CompanionBankAdditionalCoreProps {
	latch: boolean
	relative_delay: boolean
}

export interface CompanionBankPNG
	extends CompanionBankRequiredProps,
		CompanionBankAdditionalStyleProps,
		CompanionBankAdditionalCoreProps {
	style: 'png'
}

export interface CompanionBankPreset
	extends CompanionBankRequiredProps,
		Partial<CompanionBankAdditionalStyleProps>,
		Partial<CompanionBankAdditionalCoreProps> {
	style: 'png' | 'text' // 'text' for backwards compatability
}

export interface CompanionAction {
	label: string
	options: SomeCompanionInputField[]
	callback?: (action: CompanionActionEvent, info: CompanionActionEventInfo) => void
	subscribe?: (action: CompanionActionEvent) => void
	unsubscribe?: (action: CompanionActionEvent) => void
}
export interface CompanionActionEvent {
	id: string
	action: string
	options: { [key: string]: InputValue | undefined }
}

export interface CompanionActionEventInfo {
	deviceId: string | undefined
	page: number
	bank: number
}

export interface CompanionFeedbackEventInfo {
	page: number
	bank: number
}

export interface CompanionFeedbackEvent {
	id: string
	type: string
	options: { [key: string]: InputValue | undefined }
}
export interface CompanionFeedbackResult {
	color?: number
	bgcolor?: number
}

export type ConfigValue = string | number
export interface DropdownChoice {
	id: ConfigValue
	label: string
}

export type SomeCompanionInputField =
	| CompanionInputFieldText
	| CompanionInputFieldColor
	| CompanionInputFieldTextInput
	| CompanionInputFieldDropdown
	| CompanionInputFieldMultiDropdown
	| CompanionInputFieldNumber
	| CompanionInputFieldCheckbox
export interface CompanionInputField {
	id: string
	type: 'text' | 'textinput' | 'dropdown' | 'colorpicker' | 'number' | 'checkbox'
	label: string
	tooltip?: string
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
export interface CompanionInputFieldDropdown extends CompanionInputFieldDropdownBase {
	multiple?: false
	default: ConfigValue
}
export interface CompanionInputFieldMultiDropdown extends CompanionInputFieldDropdownBase {
	multiple: true
	default: ConfigValue[]

	required?: boolean

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

export interface CompanionConfigField extends CompanionInputField {
	width: number
}
export type SomeCompanionConfigField = SomeCompanionInputField & CompanionConfigField

export interface CompanionVariable {
	label: string
	name: string
}

export interface CompanionFeedbackBase<TRes> {
	type?: 'boolean' | 'advanced'
	label: string
	description: string
	options: SomeCompanionInputField[]
	callback?: (feedback: CompanionFeedbackEvent, bank: CompanionBankPNG, info: CompanionFeedbackEventInfo) => TRes
	subscribe?: (feedback: CompanionFeedbackEvent) => void
	unsubscribe?: (feedback: CompanionFeedbackEvent) => void
}
export interface CompanionFeedbackBoolean extends CompanionFeedbackBase<boolean> {
	type: 'boolean'
	style: Partial<CompanionBankRequiredProps & CompanionBankAdditionalStyleProps>
}
export interface CompanionFeedbackAdvanced extends CompanionFeedbackBase<CompanionFeedbackResult> {
	type?: 'advanced'
}
export type CompanionFeedback = CompanionFeedbackBoolean | CompanionFeedbackAdvanced

export interface CompanionPreset {
	category: string
	label: string
	bank: CompanionBankPreset
	feedbacks: Array<{
		type: string
		options: { [key: string]: InputValue | undefined }
		style?: Partial<CompanionBankRequiredProps & CompanionBankAdditionalStyleProps>
	}>
	actions: Array<{
		action: string
		options: { [key: string]: InputValue | undefined }
	}>
	release_actions?: Array<{
		action: string
		options: { [key: string]: InputValue | undefined }
	}>
}

export interface CompanionFeedbacks {
	[id: string]: CompanionFeedback | undefined
}
export interface CompanionActions {
	[id: string]: CompanionAction | undefined
}

export type CompanionUpgradeScript<TConfig> = (
	config: CompanionCoreInstanceconfig & TConfig,
	actions: CompanionMigrationAction[],
	release_actions: CompanionMigrationAction[],
	feedbacks: CompanionMigrationFeedback[]
) => boolean

export interface CompanionUpgradeToBooleanFeedbackMap {
	[feedback_id: string]:
		| true
		| {
				// Option name to style property
				[option_key: string]: 'text' | 'size' | 'color' | 'bgcolor' | 'alignment' | 'pngalignment' | 'png64'
		  }
		| undefined
}

export interface CompanionCoreInstanceconfig {
	instance_type: string
	label: string
	enabled: boolean
}

export interface CompanionMigrationAction {
	readonly id: string
	readonly instance: string
	label: string
	action: string
	options: { [key: string]: InputValue | undefined }
}

export interface CompanionMigrationFeedback {
	readonly id: string
	readonly instance_id: string
	type: string
	options: { [key: string]: InputValue | undefined }
}
