import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { EventInstance } from './EventModel.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { CollectionBase } from './Collections.js'

export interface TriggerModel {
	readonly type: 'trigger'
	options: TriggerOptions

	actions: SomeEntityModel[]
	condition: SomeEntityModel[]
	events: EventInstance[]
}

export interface TriggerOptions {
	name: string
	enabled: boolean
	sortOrder: number
	collectionId?: string
}

export interface ClientTriggerData extends TriggerOptions {
	type: 'trigger'
	lastExecuted: number | null
	description: string
}

export type TriggersUpdate =
	| TriggersUpdateInitOp
	| TriggersUpdateRemoveOp
	| TriggersUpdateAddOp
	| TriggersUpdateUpdateOp

export interface TriggersUpdateInitOp {
	type: 'init'
	triggers: Record<string, ClientTriggerData>
}

export interface TriggersUpdateRemoveOp {
	type: 'remove'
	controlId: string
}
export interface TriggersUpdateAddOp {
	type: 'add'
	controlId: string

	info: ClientTriggerData
}
export interface TriggersUpdateUpdateOp {
	type: 'update'
	controlId: string

	patch: JsonPatchOperation<ClientTriggerData>[]
}

export interface TriggerCollectionData {
	enabled: boolean
}

export type TriggerCollection = CollectionBase<TriggerCollectionData>
