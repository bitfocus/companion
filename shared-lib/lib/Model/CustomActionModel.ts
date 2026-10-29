import z from 'zod'
import { CUSTOM_ACTIONS_CONNECTION_ID } from '../ConnectionId.js'
import { ParseControlId } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import type { CollectionBase } from './Collections.js'
import { SomeEntityModelSchema } from './EntityModel.js'
import { AuthorableInputFieldSchema, INPUT_FIELD_ID_PATTERN } from './Options.js'

export type CustomActionCollection = CollectionBase<null>

export const CustomActionOptionsSchema = z.object({
	name: z.string().default('New custom action'),
	description: z.string().default(''),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
	notes: z.string().optional(),
})

export type CustomActionOptions = z.output<typeof CustomActionOptionsSchema>

/**
 * The action which runs a control, if the control is a custom action. A custom action can't contain this action, as
 * it would run itself
 */
export function getCustomActionCallDefinition(
	controlId: string
): { connectionId: string; definitionId: string } | null {
	const parsedId = ParseControlId(controlId)
	if (parsedId?.type !== 'custom-action') return null

	return { connectionId: CUSTOM_ACTIONS_CONNECTION_ID, definitionId: parsedId.customActionId }
}

/**
 * An output of a custom action: one of its local variables, whose value is written to wherever the action which
 * calls it chooses, each time it is set during a run
 */
export const CustomActionOutputSchema = z.object({
	/** Used by the actions which call the custom action to say where the output goes */
	id: z.string().regex(INPUT_FIELD_ID_PATTERN),
	label: z.string(),
	/** The name of the local variable of the custom action whose value is the output, or '' for none */
	variableName: z.string().default(''),
})

export type CustomActionOutput = z.output<typeof CustomActionOutputSchema>

/**
 * A user defined action, made of a list of other actions, with user defined inputs and outputs
 */
export const CustomActionModelSchema = z.object({
	type: z.literal('custom-action'),
	options: CustomActionOptionsSchema.default(() => CustomActionOptionsSchema.parse({})),

	/** The inputs of the action, available to its actions as `$(options:<id>)` */
	inputs: z.array(AuthorableInputFieldSchema).default(() => []),

	actions: z.array(SomeEntityModelSchema).default(() => []),

	/** The local variables of the action. Their values are scoped to each run of the action */
	localVariables: z.array(SomeEntityModelSchema).default(() => []),

	/** The outputs of the action, written to wherever each action which calls it chooses */
	outputs: z.array(CustomActionOutputSchema).default(() => []),
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
