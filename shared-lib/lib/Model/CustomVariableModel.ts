import type { CollectionBase } from './Collections.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export type CustomVariableCollection = CollectionBase<null>

export interface CustomVariableModel {
	readonly type: 'custom-variable'
	options: CustomVariableOptions

	entity: SomeEntityModel | null

	localVariables: SomeEntityModel[]
}

export interface CustomVariableOptions {
	variableName: string
	description: string
	sortOrder: number
	collectionId?: string
}

export interface ClientCustomVariableData extends CustomVariableOptions {
	type: 'custom-variable'
	isActive: boolean
	isUserValue: boolean
}

export type CustomVariableUpdate =
	| CustomVariableUpdateInitOp
	| CustomVariableUpdateAddOp
	| CustomVariableUpdateRemoveOp
	| CustomVariableUpdateUpdateOp

export interface CustomVariableUpdateInitOp {
	type: 'init'
	variables: Record<string, ClientCustomVariableData>
}
export interface CustomVariableUpdateRemoveOp {
	type: 'remove'
	controlId: string
}
export interface CustomVariableUpdateUpdateOp {
	type: 'update'
	controlId: string

	patch: JsonPatchOperation<ClientCustomVariableData>[]
}
export interface CustomVariableUpdateAddOp {
	type: 'add'
	controlId: string

	info: ClientCustomVariableData
}
