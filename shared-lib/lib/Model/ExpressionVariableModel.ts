import z from 'zod'
import type { ExpressionVariableControlId } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import type { CollectionBase } from './Collections.js'
import { SomeEntityModelSchema } from './EntityModel.js'

export type ExpressionVariableCollection = CollectionBase<null>

export const ExpressionVariableOptionsSchema = z.object({
	variableName: z.string().default(''),
	description: z.string().default('An expression variable'),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
	notes: z.string().default(''),
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
	variables: Record<ExpressionVariableControlId, ClientExpressionVariableData>
}
export interface ExpressionVariableUpdateRemoveOp {
	type: 'remove'
	controlId: ExpressionVariableControlId
}
export interface ExpressionVariableUpdateUpdateOp {
	type: 'update'
	controlId: ExpressionVariableControlId

	patch: ObjectPatch<ClientExpressionVariableData>
}
export interface ExpressionVariableUpdateAddOp {
	type: 'add'
	controlId: ExpressionVariableControlId

	info: ClientExpressionVariableData
}
