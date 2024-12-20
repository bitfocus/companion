import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { ObjectsDiff } from './Common.js'
import type { InternalFeedbackInputField } from './Options.js'
import { EntitySupportedChildGroupDefinition } from './EntityModel.js'

export interface FeedbackDefinition {
	label: string
	description: string | undefined
	options: InternalFeedbackInputField[]
	type: 'advanced' | 'boolean'
	style: Partial<CompanionButtonStyleProps> | undefined
	hasLearn: boolean
	learnTimeout: number | undefined
	showInvert: boolean

	showButtonPreview: boolean
	supportsChildGroups: EntitySupportedChildGroupDefinition[]
}

export type ClientFeedbackDefinition = FeedbackDefinition

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

	feedbacks: Record<string, ClientFeedbackDefinition | undefined>
}
export interface FeedbackDefinitionUpdateUpdateConnection extends ObjectsDiff<ClientFeedbackDefinition> {
	type: 'update-connection'
	connectionId: string
}
