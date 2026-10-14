import type { CollectionBase } from './Collections.js'
import type { VariableValue } from './Variables.js'

export interface CustomVariableDefinition {
	description: string
	/** Internal notes for whoever maintains the configuration. Absent on variables saved before notes existed */
	notes?: string
	defaultValue: VariableValue
	persistCurrentValue: boolean
	sortOrder: number
	collectionId?: string
}

export type CustomVariableCollection = CollectionBase<null>

export type CustomVariablesModel = Record<string, CustomVariableDefinition>

export type CustomVariableUpdate =
	CustomVariableUpdateInitOp | CustomVariableUpdateRemoveOp | CustomVariableUpdateUpdateOp

export interface CustomVariableUpdateInitOp {
	type: 'init'
	info: CustomVariablesModel
}
export interface CustomVariableUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface CustomVariableUpdateUpdateOp {
	type: 'update'
	itemId: string

	info: CustomVariableDefinition
}
