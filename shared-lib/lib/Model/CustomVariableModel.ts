import type { CompanionVariableValue } from '@companion-module/base'
import type { CollectionBase } from './Collections.js'

export interface CustomVariableDefinition {
	description: string
	defaultValue: CompanionVariableValue
	persistCurrentValue: boolean
	sortOrder: number
	collectionId?: string
}

export type CustomVariableCollection = CollectionBase<null>

export type CustomVariablesModel = Record<string, CustomVariableDefinition>

export type CustomVariableUpdate =
	| CustomVariableUpdateInitOp
	| CustomVariableUpdateRemoveOp
	| CustomVariableUpdateUpdateOp

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
