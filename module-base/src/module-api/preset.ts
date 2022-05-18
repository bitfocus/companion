import { InputValue } from './input.js'

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
	relative_delay: boolean
}
export interface CompanionBankAdditionalPressProps {}
export interface CompanionBankAdditionalSteppedProps {
	step_auto_progress: boolean
}

export interface CompanionBankPresetBase<T extends string>
	extends CompanionBankRequiredProps,
		Partial<CompanionBankAdditionalStyleProps>,
		Partial<CompanionBankAdditionalCoreProps> {
	style: T
}

export interface CompanionPresetFeedback {
	feedbackId: string
	options: { [key: string]: InputValue | undefined }
	style?: Partial<CompanionBankRequiredProps & CompanionBankAdditionalStyleProps>
}
export interface CompanionPresetAction {
	actionId: string
	options: { [key: string]: InputValue | undefined }
}

export interface CompanionPresetPress {
	id: string
	category: string
	label: string
	bank: CompanionBankPresetBase<'press'> & Partial<CompanionBankAdditionalPressProps>
	feedbacks: CompanionPresetFeedback[]
	action_sets: {
		down: CompanionPresetAction[]
		up: CompanionPresetAction[]
	}
}

export interface CompanionPresetStepped {
	id: string
	category: string
	label: string
	bank: CompanionBankPresetBase<'step'> & Partial<CompanionBankAdditionalSteppedProps>
	feedbacks: CompanionPresetFeedback[]
	action_sets: {
		[step: number]: CompanionPresetAction[]
	}
}
export type SomeCompanionPreset = CompanionPresetStepped | CompanionPresetPress
