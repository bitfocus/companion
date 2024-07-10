import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { SetOptional } from 'type-fest'
import type { ObjectsDiff } from './Common.js'
import type { InternalFeedbackInputField } from './Options.js'

export interface FeedbackDefinition {
	label: string
	description: string | undefined
	options: InternalFeedbackInputField[]
	type: 'advanced' | 'boolean'
	style: Partial<CompanionButtonStyleProps> | undefined
	hasLearn: boolean
	learnTimeout: number | undefined
	showInvert: boolean
}

export interface InternalFeedbackDefinition extends SetOptional<FeedbackDefinition, 'hasLearn' | 'learnTimeout'> {
	showButtonPreview?: boolean

	supportsChildFeedbacks?: boolean
}

export type FeedbackDefinitionUpdate =
	| FeedbackDefinitionUpdateForgetConnection
	| FeedbackDefinitionUpdateAddConnection
	| FeedbackDefinitionUpdateUpdateConnection

export interface FeedbackDefinitionUpdateForgetConnection {
	type: 'forget-connection'
	connectionId: string
}
export interface FeedbackDefinitionUpdateAddConnection {
	type: 'add-connection'
	connectionId: string

	feedbacks: Record<string, InternalFeedbackDefinition | undefined>
}
export interface FeedbackDefinitionUpdateUpdateConnection extends ObjectsDiff<InternalFeedbackDefinition> {
	type: 'update-connection'
	connectionId: string
}
