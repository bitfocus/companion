import type { InternalActionInputField } from './Options.js'
import type { ObjectsDiff } from './Common.js'
import type { EntitySupportedChildGroupDefinition } from './EntityModel.js'

export interface ActionDefinition {
	label: string
	description: string | undefined
	options: InternalActionInputField[]
	hasLearn: boolean
	learnTimeout: number | undefined

	showButtonPreview: boolean
	supportsChildGroups: EntitySupportedChildGroupDefinition[]
}

export interface ClientActionDefinition extends ActionDefinition {}

export type ActionDefinitionUpdate =
	| ActionDefinitionUpdateForgetConnection
	| ActionDefinitionUpdateAddConnection
	| ActionDefinitionUpdateUpdateConnection

export interface ActionDefinitionUpdateForgetConnection {
	type: 'forget-connection'
	connectionId: string
}
export interface ActionDefinitionUpdateAddConnection {
	type: 'add-connection'
	connectionId: string

	actions: Record<string, ClientActionDefinition | undefined>
}
export interface ActionDefinitionUpdateUpdateConnection extends ObjectsDiff<ClientActionDefinition> {
	type: 'update-connection'
	connectionId: string
}
