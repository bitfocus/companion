import type { EntityModelType, EntitySupportedChildGroupDefinition, FeedbackEntitySubType } from './EntityModel.js'
import type { InternalActionInputField, InternalFeedbackInputField } from './Options.js'
import type { CompanionButtonStyleProps } from '@companion-module/base'
import type { ObjectsDiff } from './Common.js'

export interface ClientEntityDefinition {
	entityType: EntityModelType
	label: string
	description: string | undefined
	options: (InternalActionInputField | InternalFeedbackInputField)[]
	feedbackType: FeedbackEntitySubType | null
	feedbackStyle: Partial<CompanionButtonStyleProps> | undefined
	hasLearn: boolean
	learnTimeout: number | undefined
	showInvert: boolean

	showButtonPreview: boolean
	supportsChildGroups: EntitySupportedChildGroupDefinition[]
}

export type EntityDefinitionUpdate =
	| EntityDefinitionUpdateForgetConnection
	| EntityDefinitionUpdateAddConnection
	| EntityDefinitionUpdateUpdateConnection

export interface EntityDefinitionUpdateForgetConnection {
	type: 'forget-connection'
	connectionId: string
}
export interface EntityDefinitionUpdateAddConnection {
	type: 'add-connection'
	connectionId: string

	entities: Record<string, ClientEntityDefinition | undefined>
}
export interface EntityDefinitionUpdateUpdateConnection extends ObjectsDiff<ClientEntityDefinition> {
	type: 'update-connection'
	connectionId: string
}
