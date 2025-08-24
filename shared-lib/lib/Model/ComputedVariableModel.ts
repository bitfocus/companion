import type { CollectionBase } from './Collections.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export type ComputedVariableCollection = CollectionBase<null>

export interface ComputedVariableModel {
	readonly type: 'computed-variable'
	options: ComputedVariableOptions

	entity: SomeEntityModel | null

	localVariables: SomeEntityModel[]
}

export interface ComputedVariableOptions {
	variableName: string
	description: string
	sortOrder: number
	collectionId?: string
}

export interface ClientComputedVariableData extends ComputedVariableOptions {
	type: 'computed-variable'
	isActive: boolean
}

export type ComputedVariableUpdate =
	| ComputedVariableUpdateInitOp
	| ComputedVariableUpdateAddOp
	| ComputedVariableUpdateRemoveOp
	| ComputedVariableUpdateUpdateOp

export interface ComputedVariableUpdateInitOp {
	type: 'init'
	variables: Record<string, ClientComputedVariableData>
}
export interface ComputedVariableUpdateRemoveOp {
	type: 'remove'
	controlId: string
}
export interface ComputedVariableUpdateUpdateOp {
	type: 'update'
	controlId: string

	patch: JsonPatchOperation<ClientComputedVariableData>[]
}
export interface ComputedVariableUpdateAddOp {
	type: 'add'
	controlId: string

	info: ClientComputedVariableData
}
