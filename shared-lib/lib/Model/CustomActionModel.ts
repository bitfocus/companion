import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { CollectionBase } from './Collections.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { SomeCompanionInputField } from './Options.js'

export type CustomActionCollection = CollectionBase<null>

/**
 * A user defined action, made of a list of other actions, with user defined inputs
 */
export interface CustomActionModel {
	readonly type: 'custom-action'
	options: CustomActionOptions

	/** The inputs of the action, available to its actions as `$(options:<id>)` */
	inputs: SomeCompanionInputField[]

	actions: SomeEntityModel[]

	/** The local variables of the action. Their values are scoped to each run of the action */
	localVariables: SomeEntityModel[]
}

export type CustomActionOptions = {
	name: string
	description: string
	sortOrder: number
	collectionId?: string
	/** The name of the local variable whose value is the result of the action, if any */
	resultVariable: string | null
	notes?: string
}

export interface ClientCustomActionData extends CustomActionOptions {
	type: 'custom-action'
}

export type CustomActionsUpdate =
	CustomActionsUpdateInitOp | CustomActionsUpdateAddOp | CustomActionsUpdateRemoveOp | CustomActionsUpdateUpdateOp

export interface CustomActionsUpdateInitOp {
	type: 'init'
	customActions: Record<string, ClientCustomActionData>
}
export interface CustomActionsUpdateRemoveOp {
	type: 'remove'
	controlId: string
}
export interface CustomActionsUpdateUpdateOp {
	type: 'update'
	controlId: string

	patch: JsonPatchOperation<ClientCustomActionData>[]
}
export interface CustomActionsUpdateAddOp {
	type: 'add'
	controlId: string

	info: ClientCustomActionData
}
