import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import z from 'zod'
import type { CollectionBase } from './Collections.js'
import { SomeEntityModelSchema } from './EntityModel.js'

export type ExpressionVariableCollection = CollectionBase<null>

export const ExpressionVariableOptionsSchema = z.object({
	variableName: z.string().default(''),
	description: z.string().default('An expression variable'),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
	notes: z.string().optional(),
})

export type ExpressionVariableOptions = z.output<typeof ExpressionVariableOptionsSchema>

export const ExpressionVariableModelSchema = z.object({
	type: z.literal('expression-variable'),
	options: ExpressionVariableOptionsSchema.default(() => ExpressionVariableOptionsSchema.parse({})),

	entity: SomeEntityModelSchema.nullable().default(null),

	localVariables: z.array(SomeEntityModelSchema).default(() => []),
})

export type ExpressionVariableModel = z.output<typeof ExpressionVariableModelSchema>

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
