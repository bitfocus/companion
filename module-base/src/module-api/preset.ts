import { CompanionFeedbackButtonStyleResult } from './feedback.js'
import { InputValue } from './input.js'
import { CompanionAdditionalStyleProps, CompanionRequiredStyleProps } from './style.js'

/**
 * The base options for a preset
 */
export interface CompanionPresetOptions {
	relativeDelay?: boolean
}

/**
 * The options for a press button preset
 */
export type CompanionPressPresetOptions = CompanionPresetOptions

/**
 * The options for a stepped button preset
 */
export interface CompanionSteppedPresetOptions extends CompanionPresetOptions {
	stepAutoProgress?: boolean
}

/**
 * The style properties for a preset
 */
export type CompanionPresetStyle = CompanionRequiredStyleProps & Partial<CompanionAdditionalStyleProps>

/**
 * The configuration of an feedback in a preset
 */
export interface CompanionPresetFeedback {
	/** The id of the feedback definition */
	feedbackId: string
	/** The option values for the action */
	options: { [key: string]: InputValue | undefined }
	/**
	 * If a boolean feedback, the style effect of the feedback
	 */
	style?: CompanionFeedbackButtonStyleResult
}

/**
 * The configuration of an action in a preset
 */
export interface CompanionPresetAction {
	/** The id of the action definition */
	actionId: string
	/** The execution delay of the action */
	delay?: number
	/** The option values for the action */
	options: { [key: string]: InputValue | undefined }
}

/**
 * The definition of a press button preset
 */
export interface CompanionPressButtonPresetDefinition {
	/** The type of this preset */
	type: 'press'
	/** A unique id for this preset */
	id: string
	/** The category of this preset, for grouping */
	category: string
	/** The name of this preset */
	name: string
	/** The base style of this preset */
	style: CompanionPresetStyle
	/** Options for this preset */
	options?: CompanionPressPresetOptions
	/** The feedbacks on the button */
	feedbacks: CompanionPresetFeedback[]
	actions: {
		/** The button down actions */
		down: CompanionPresetAction[]
		/** The button up actions */
		up: CompanionPresetAction[]
	}
}

/**
 * The definition of a stepped button preset
 */
export interface CompanionSteppedButtonPresetDefinition {
	/** The type of this preset */
	type: 'step'
	/** A unique id for this preset */
	id: string
	/** The category of this preset, for grouping */
	category: string
	/** The name of this preset */
	name: string
	/** The base style of this preset */
	style: CompanionPresetStyle
	/** Options for this preset */
	options?: CompanionSteppedPresetOptions
	/** The feedbacks on the button */
	feedbacks: CompanionPresetFeedback[]
	/** The steps of this button, and their actions */
	actions: {
		[step: number]: CompanionPresetAction[]
	}
}

/**
 * The definition of some preset
 */
export type SomeCompanionPresetDefinition =
	| CompanionSteppedButtonPresetDefinition
	| CompanionPressButtonPresetDefinition
