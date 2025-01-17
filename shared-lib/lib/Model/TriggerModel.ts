import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { EventInstance } from './EventModel.js'
import type { SomeEntityModel } from './EntityModel.js'

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
}

export interface ClientTriggerData extends TriggerOptions {
	type: 'trigger'
	lastExecuted: number | undefined
	description: string
}

export type TriggersUpdate = TriggersUpdateRemoveOp | TriggersUpdateAddOp | TriggersUpdateUpdateOp

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

	patch: JsonPatchOperation[]
}
