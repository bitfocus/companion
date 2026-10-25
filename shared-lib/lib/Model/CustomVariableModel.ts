import z from 'zod'
import type { CollectionBase } from './Collections.js'
import { JsonValueSchema } from './Options.js'

export const CustomVariableDefinitionSchema = z.object({
	description: z.string().default(''),
	/** Internal notes for whoever maintains the configuration. Absent on variables saved before notes existed */
	notes: z.string().optional(),
	defaultValue: JsonValueSchema.optional(),
	persistCurrentValue: z.boolean().default(false),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
})

export type CustomVariableDefinition = z.output<typeof CustomVariableDefinitionSchema>

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
