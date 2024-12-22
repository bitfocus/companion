import type { ObjectsDiff } from './Common.js'
import type { ClientEntityDefinition } from './EntityDefinitionModel.js'

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

	feedbacks: Record<string, ClientEntityDefinition | undefined>
}
export interface FeedbackDefinitionUpdateUpdateConnection extends ObjectsDiff<ClientEntityDefinition> {
	type: 'update-connection'
	connectionId: string
}
