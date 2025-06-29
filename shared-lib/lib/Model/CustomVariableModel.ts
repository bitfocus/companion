import type { CompanionVariableValue } from '@companion-module/base'
import type { CollectionBase } from './Collections.js'
import type { FeedbackEntityModel, SomeEntityModel } from './EntityModel.js'

export interface CustomVariablesControlModel {
	readonly type: 'custom_variables'
	options: Record<string, never>

	variables: SomeEntityModel[]
}

export interface CustomVariableDefinition {
	description: string
	defaultValue: CompanionVariableValue
	persistCurrentValue: boolean
	sortOrder: number
	collectionId?: string
}

export type CustomVariableCollection = CollectionBase<undefined>

export type CustomVariablesModel = FeedbackEntityModel[]

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
