import type { CompanionVariableValue } from '@companion-module/base'
import type { CollectionBase } from './Collections.js'
import type { FeedbackEntityModel, SomeEntityModel } from './EntityModel.js'

export const CustomVariableControlId = 'custom_variables:default'

export interface CustomVariablesControlModel {
	readonly type: 'custom_variables'
	options: Record<string, never>

	variables: SomeEntityModel[]
}

export interface CustomVariableEntityModel extends FeedbackEntityModel {
	// collectionId?: string // TODO - how can this work?
}

export interface ClientCustomVariableEntityModel extends CustomVariableEntityModel {
	sortOrder: number
}

export interface CustomVariableDefinition {
	description: string
	defaultValue: CompanionVariableValue
	persistCurrentValue: boolean
	sortOrder: number
	collectionId?: string
}

export type CustomVariableCollection = CollectionBase<undefined>

export type CustomVariablesModel = Record<string, ClientCustomVariableEntityModel>

export type CustomVariableUpdate = CustomVariableUpdateRemoveOp | CustomVariableUpdateUpdateOp

export interface CustomVariableUpdateRemoveOp {
	type: 'remove'
	itemId: string
}
export interface CustomVariableUpdateUpdateOp {
	type: 'update'
	itemId: string

	info: ClientCustomVariableEntityModel
}
