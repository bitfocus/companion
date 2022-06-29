import { SomeCompanionInputField, CompanionOptionValues } from './input.js'
import { CompanionAdditionalStyleProps, CompanionRequiredStyleProps } from './style.js'

/**
 * Basic information about an instance of an feedback
 */
export interface CompanionFeedbackInfo {
	/** The type of the feedback */
	readonly type: 'boolean' | 'advanced'
	/** The unique id for this feedback */
	readonly id: string
	/** The unique id for the location of this feedback */
	readonly controlId: string
	/** The id of the feedback definition */
	readonly feedbackId: string
	/** The user selected options for the feedback */
	readonly options: CompanionOptionValues
}

/**
 * Extended information for execution of a boolean feedback
 */
export interface CompanionFeedbackBooleanEvent extends CompanionFeedbackInfo {
	readonly type: 'boolean'

	/** @deprecated */
	readonly rawBank: any
}

/**
 * Extended information for execution of an advanced feedback
 */
export interface CompanionFeedbackAdvancedEvent extends CompanionFeedbackInfo {
	readonly type: 'advanced'

	/** If control supports an imageBuffer, the dimensions the buffer must be */
	readonly image?: {
		readonly width: number
		readonly height: number
	}

	/** @deprecated */
	readonly page: number
	/** @deprecated */
	readonly bank: number

	/** @deprecated */
	readonly rawBank: any
}

/**
 * The resulting style of a boolean feedback
 */
export type CompanionFeedbackButtonStyleResult = Partial<CompanionRequiredStyleProps & CompanionAdditionalStyleProps>

/** The resulting style of an advanced feedback */
export interface CompanionAdvancedFeedbackResult extends CompanionFeedbackButtonStyleResult {
	imageBuffer?: Buffer
}

/**
 * The common definition of a feedback
 */
export interface CompanionFeedbackDefinitionBase {
	type: 'boolean' | 'advanced'
	/** Name to show in the feedbacks list */
	name: string
	/** Additional description of the feedback */
	description?: string
	/** The input fields for the feedback */
	options: SomeCompanionInputField[]
	/**
	 * Called to report the existence of an feedback
	 * Useful to ensure necessary data is loaded
	 */
	subscribe?: (feedback: CompanionFeedbackInfo) => void
	/**
	 * Called to report an feedback has been edited/removed
	 * Useful to cleanup subscriptions setup in subscribe
	 */
	unsubscribe?: (feedback: CompanionFeedbackInfo) => void

	/**
	 * The user requested to 'learn' the values for this feedback.
	 */
	learn?: (
		action: CompanionFeedbackInfo
	) => CompanionOptionValues | undefined | Promise<CompanionOptionValues | undefined>
}

/**
 * The definition of a boolean feedback
 */
export interface CompanionBooleanFeedbackDefinition extends CompanionFeedbackDefinitionBase {
	/** The type of the feedback */
	type: 'boolean'
	/** The default style properties for this feedback */
	defaultStyle: Partial<CompanionFeedbackButtonStyleResult>
	/** Called to get the feedback value */
	callback: (feedback: CompanionFeedbackBooleanEvent) => boolean
}

/**
 * The definition of an advanced feedback
 */
export interface CompanionAdvancedFeedbackDefinition extends CompanionFeedbackDefinitionBase {
	/** The type of the feedback */
	type: 'advanced'
	/** Called to get the feedback value */
	callback: (feedback: CompanionFeedbackAdvancedEvent) => CompanionAdvancedFeedbackResult
}

/**
 * The definition of some feedback
 */
export type CompanionFeedbackDefinition = CompanionBooleanFeedbackDefinition | CompanionAdvancedFeedbackDefinition

/**
 * The definitions of a group of feedbacks
 */
export interface CompanionFeedbackDefinitions {
	[id: string]: CompanionFeedbackDefinition | undefined
}
