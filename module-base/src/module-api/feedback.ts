import { SomeCompanionInputField, InputValue } from './input.js'
import { CompanionAlignment, CompanionTextSize } from './preset.js'

export interface CompanionFeedbackEvent {
	type: 'boolean' | 'advanced'
	id: string
	feedbackId: string
	controlId: string
	options: { [key: string]: InputValue | undefined }
}

export interface CompanionFeedbackBooleanEvent extends CompanionFeedbackEvent {
	type: 'boolean'

	/** @deprecated */
	rawBank: any
}
export interface CompanionFeedbackAdvancedEvent extends CompanionFeedbackEvent {
	type: 'advanced'
	/** If control supports an imageBuffer, the dimensions the buffer must be */
	image?: {
		width: number
		height: number
	}

	/** @deprecated */
	page: number
	/** @deprecated */
	bank: number

	/** @deprecated */
	rawBank: any
}

export interface CompanionFeedbackButtonStyleResult {
	// TODO - more props
	color?: number
	bgcolor?: number
	text?: string
	imageBuffer?: Buffer
	size?: CompanionTextSize
	alignment?: CompanionAlignment
	pngalignment?: CompanionAlignment
	png64?: string
}

export interface CompanionFeedbackBase {
	type: 'boolean' | 'advanced'
	name: string
	description?: string
	options: SomeCompanionInputField[]
	subscribe?: (feedback: CompanionFeedbackEvent) => void
	unsubscribe?: (feedback: CompanionFeedbackEvent) => void
}
export interface CompanionFeedbackBoolean extends CompanionFeedbackBase {
	type: 'boolean'
	defaultStyle: Partial<CompanionFeedbackButtonStyleResult>
	callback: (feedback: CompanionFeedbackBooleanEvent) => boolean
}
export interface CompanionFeedbackAdvanced extends CompanionFeedbackBase {
	type: 'advanced'
	callback: (feedback: CompanionFeedbackAdvancedEvent) => CompanionFeedbackButtonStyleResult
}

export type CompanionFeedback = CompanionFeedbackBoolean | CompanionFeedbackAdvanced

export interface CompanionFeedbacks {
	[id: string]: CompanionFeedback | undefined
}
