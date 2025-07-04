import type { CompanionVariableValue } from '@companion-module/base'
import type { CollectionBase } from './Collections.js'
import type { SomeEntityModel } from './EntityModel.js'
import type { Operation as JsonPatchOperation } from 'fast-json-patch'

/** @deprecated */
export interface CustomVariableDefinition {
	description: string
	defaultValue: CompanionVariableValue
	persistCurrentValue: boolean
	sortOrder: number
	collectionId?: string
}

export type CustomVariableCollection = CollectionBase<undefined>

/** @deprecated */
export type CustomVariablesModel = Record<string, CustomVariableDefinition>

/** @deprecated */
export type CustomVariableUpdate = CustomVariableUpdateRemoveOp | CustomVariableUpdateUpdateOp

export interface CustomVariableUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface CustomVariableUpdateUpdateOp {
	type: 'update'
	itemId: string

	info: CustomVariableDefinition
}

export interface CustomVariableModel2 {
	readonly type: 'custom-variable'
	options: CustomVariableOptions

	entity: SomeEntityModel | null
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
	// id: string
	// TODO - define me
	// lastExecuted: number | undefined
	// description: string
}

export type CustomVariableUpdate2 =
	| CustomVariableUpdateAddOp2
	| CustomVariableUpdateRemoveOp2
	| CustomVariableUpdateUpdateOp2

export interface CustomVariableUpdateRemoveOp2 {
	type: 'remove'
	controlId: string
}
export interface CustomVariableUpdateUpdateOp2 {
	type: 'update'
	controlId: string

	patch: JsonPatchOperation[]
}
export interface CustomVariableUpdateAddOp2 {
	type: 'add'
	controlId: string

	info: ClientCustomVariableData
}
