import z from 'zod'
import { CUSTOM_FEEDBACKS_CONNECTION_ID } from '../ConnectionId.js'
import { ParseControlId } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import type { CollectionBase } from './Collections.js'
import { SomeEntityModelSchema } from './EntityModel.js'
import { AuthorableInputFieldSchema } from './Options.js'

export type CustomFeedbackCollection = CollectionBase<null>

export const CustomFeedbackOptionsSchema = z.object({
	name: z.string().default('New custom feedback'),
	description: z.string().default(''),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
	notes: z.string().optional(),
})

export type CustomFeedbackOptions = z.output<typeof CustomFeedbackOptionsSchema>

/**
 * The feedback which uses a control, if the control is a custom feedback. A custom feedback can't contain this
 * feedback, as it would depend on itself
 */
export function getCustomFeedbackCallDefinition(
	controlId: string
): { connectionId: string; definitionId: string } | null {
	const parsedId = ParseControlId(controlId)
	if (parsedId?.type !== 'custom-feedback') return null

	return { connectionId: CUSTOM_FEEDBACKS_CONNECTION_ID, definitionId: parsedId.customFeedbackId }
}

/**
 * A user defined boolean feedback, which is true when all of its feedbacks are, with user defined inputs
 */
export const CustomFeedbackModelSchema = z.object({
	type: z.literal('custom-feedback'),
	options: CustomFeedbackOptionsSchema.default(() => CustomFeedbackOptionsSchema.parse({})),

	/** The inputs of the feedback, available to its feedbacks as `$(options:<id>)` */
	inputs: z.array(AuthorableInputFieldSchema).default(() => []),

	/** The boolean feedbacks which must all be true for the custom feedback to be true */
	feedbacks: z.array(SomeEntityModelSchema).default(() => []),

	/** The local variables of the feedback. Each use of the feedback has its own values for them */
	localVariables: z.array(SomeEntityModelSchema).default(() => []),
})

export type CustomFeedbackModel = z.output<typeof CustomFeedbackModelSchema>

export interface ClientCustomFeedbackData extends CustomFeedbackOptions {
	type: 'custom-feedback'
}

export type CustomFeedbacksUpdate =
	| CustomFeedbacksUpdateInitOp
	| CustomFeedbacksUpdateAddOp
	| CustomFeedbacksUpdateRemoveOp
	| CustomFeedbacksUpdateUpdateOp

export interface CustomFeedbacksUpdateInitOp {
	type: 'init'
	customFeedbacks: Record<string, ClientCustomFeedbackData>
}
export interface CustomFeedbacksUpdateRemoveOp {
	type: 'remove'
	controlId: string
}
export interface CustomFeedbacksUpdateUpdateOp {
	type: 'update'
	controlId: string

	patch: ObjectPatch<ClientCustomFeedbackData>
}
export interface CustomFeedbacksUpdateAddOp {
	type: 'add'
	controlId: string

	info: ClientCustomFeedbackData
}
