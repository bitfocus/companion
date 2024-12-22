import type { ObjectsDiff } from './Common.js'
import type { ClientEntityDefinition } from './EntityDefinitionModel.js'

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

	actions: Record<string, ClientEntityDefinition | undefined>
}
export interface ActionDefinitionUpdateUpdateConnection extends ObjectsDiff<ClientEntityDefinition> {
	type: 'update-connection'
	connectionId: string
}
