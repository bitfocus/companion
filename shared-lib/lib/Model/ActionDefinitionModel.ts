import type { SetOptional } from 'type-fest'
import type { InternalActionInputField } from './Options.js'
import { ObjectsDiff } from './Common.js'

export interface ActionDefinition {
	label: string
	description: string | undefined
	options: InternalActionInputField[]
	hasLearn: boolean
	learnTimeout: number | undefined
}

export interface InternalActionDefinition
	extends SetOptional<Omit<ActionDefinition, 'options'>, 'hasLearn' | 'learnTimeout'> {
	showButtonPreview?: boolean
	options: InternalActionInputField[]

	supportsChildActions?: boolean
}

export interface ClientActionDefinition extends InternalActionDefinition {}

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
