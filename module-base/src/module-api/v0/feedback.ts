import { SomeCompanionInputField, InputValue } from './input.js';

export interface CompanionFeedbackEvent {
	feedbackId: string;
	options: { [key: string]: InputValue | undefined };
}

export type CompanionFeedbackBooleanEvent = CompanionFeedbackEvent;
export interface CompanionFeedbackAdvancedEvent extends CompanionFeedbackEvent {
	/** If control supports an imageBuffer, the dimensions the buffer must be */
	image?: {
		width: number;
		height: number;
	};
}

export interface CompanionFeedbackButtonStyleResult {
	// TODO - more props
	color?: number;
	bgcolor?: number;
	text?: string;
	imageBuffer?: Buffer;
}

export interface CompanionFeedbackBase {
	type: 'boolean' | 'advanced';
	name: string;
	description?: string;
	options: SomeCompanionInputField[];
	subscribe?: (feedback: CompanionFeedbackEvent) => void;
	unsubscribe?: (feedback: CompanionFeedbackEvent) => void;
}
export interface CompanionFeedbackBoolean extends CompanionFeedbackBase {
	type: 'boolean';
	defaultStyle: Partial<CompanionFeedbackButtonStyleResult>;
	callback: (feedback: CompanionFeedbackBooleanEvent) => boolean;
}
export interface CompanionFeedbackAdvanced extends CompanionFeedbackBase {
	type: 'advanced';
	callback: (feedback: CompanionFeedbackAdvancedEvent) => CompanionFeedbackButtonStyleResult;
}

export type CompanionFeedback = CompanionFeedbackBoolean | CompanionFeedbackAdvanced;

export interface CompanionFeedbacks {
	[id: string]: CompanionFeedback | undefined;
}
