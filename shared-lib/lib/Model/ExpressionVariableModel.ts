import type { CollectionBase } from './Collections.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { Operation as JsonPatchOperation } from 'fast-json-patch'

export type ExpressionVariableCollection = CollectionBase<null>

export interface ExpressionVariableModel {
	readonly type: 'expression-variable'
	options: ExpressionVariableOptions

	entity: SomeEntityModel | null

	localVariables: SomeEntityModel[]
}

export type ExpressionVariableOptions = {
	variableName: string
	description: string
	sortOrder: number
	collectionId?: string
}

export interface ClientExpressionVariableData extends ExpressionVariableOptions {
	type: 'expression-variable'
	isActive: boolean
}

export type ExpressionVariableUpdate =
	| ExpressionVariableUpdateInitOp
	| ExpressionVariableUpdateAddOp
	| ExpressionVariableUpdateRemoveOp
	| ExpressionVariableUpdateUpdateOp

export interface ExpressionVariableUpdateInitOp {
	type: 'init'
	variables: Record<string, ClientExpressionVariableData>
}
export interface ExpressionVariableUpdateRemoveOp {
	type: 'remove'
	controlId: string
}
export interface ExpressionVariableUpdateUpdateOp {
	type: 'update'
	controlId: string

	patch: JsonPatchOperation<ClientExpressionVariableData>[]
}
export interface ExpressionVariableUpdateAddOp {
	type: 'add'
	controlId: string

	info: ClientExpressionVariableData
}
