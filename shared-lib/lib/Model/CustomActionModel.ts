import z from 'zod'
import type { ObjectPatch } from '../Diff.js'
import type { CollectionBase } from './Collections.js'
import { SomeEntityModelSchema } from './EntityModel.js'
import { AuthorableInputFieldSchema, type AuthorableInputField } from './Options.js'

export type CustomActionCollection = CollectionBase<null>

export const CustomActionOptionsSchema = z.object({
	name: z.string().default('New custom action'),
	description: z.string().default(''),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
	/** The name of the local variable whose value is the result of the action, if any */
	resultVariable: z.string().nullable().default(null),
	notes: z.string().optional(),
})

export type CustomActionOptions = z.output<typeof CustomActionOptionsSchema>

/** The pattern the id of an input of a custom action must match, as it is used in `$(options:<id>)` */
export const CUSTOM_ACTION_INPUT_ID_PATTERN = /^[\w-]+$/

/**
 * Schema of an input of a custom action.
 * An input must be a type of field which a user can author, and its visibility can only be an expression, as a
 * function would be code from the user run in the ui.
 */
export const CustomActionInputSchema = AuthorableInputFieldSchema.refine(
	(field) =>
		(!field.isVisibleUi || field.isVisibleUi.type === 'expression') && CUSTOM_ACTION_INPUT_ID_PATTERN.test(field.id),
	{ message: "Can't be used as an input of a custom action" }
)

/**
 * Check if an input field definition is valid for an input of a custom action
 */
export function isValidCustomActionInput(field: unknown): field is AuthorableInputField {
	return CustomActionInputSchema.safeParse(field).success
}

/**
 * A user defined action, made of a list of other actions, with user defined inputs
 */
export const CustomActionModelSchema = z.object({
	type: z.literal('custom-action'),
	options: CustomActionOptionsSchema.default(() => CustomActionOptionsSchema.parse({})),

	/** The inputs of the action, available to its actions as `$(options:<id>)` */
	inputs: z.array(CustomActionInputSchema).default(() => []),

	actions: z.array(SomeEntityModelSchema).default(() => []),

	/** The local variables of the action. Their values are scoped to each run of the action */
	localVariables: z.array(SomeEntityModelSchema).default(() => []),
})

export type CustomActionModel = z.output<typeof CustomActionModelSchema>

export interface ClientCustomActionData extends CustomActionOptions {
	type: 'custom-action'
}

export type CustomActionsUpdate =
	CustomActionsUpdateInitOp | CustomActionsUpdateAddOp | CustomActionsUpdateRemoveOp | CustomActionsUpdateUpdateOp

export interface CustomActionsUpdateInitOp {
	type: 'init'
	customActions: Record<string, ClientCustomActionData>
}
export interface CustomActionsUpdateRemoveOp {
	type: 'remove'
	controlId: string
}
export interface CustomActionsUpdateUpdateOp {
	type: 'update'
	controlId: string

	patch: ObjectPatch<ClientCustomActionData>
}
export interface CustomActionsUpdateAddOp {
	type: 'add'
	controlId: string

	info: ClientCustomActionData
}
