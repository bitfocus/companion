import type { CompanionVariableValue } from '@companion-module/base'

export interface CustomVariableDefinition {
	description: string
	defaultValue: CompanionVariableValue
	persistCurrentValue: boolean
	sortOrder: number
}

export type CustomVariablesModel = Record<string, CustomVariableDefinition>

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
