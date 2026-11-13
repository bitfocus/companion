import z from 'zod'
import { CUSTOM_CONNECTION_ID } from '../ConnectionId.js'
import { ParseControlId, type CustomFeedbackControlId, type SomeControlId } from '../ControlId.js'
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
	notes: z.string().default(''),
})

export type CustomFeedbackOptions = z.output<typeof CustomFeedbackOptionsSchema>

/**
 * The feedback which uses a control, if the control is a custom feedback. A custom feedback can't contain this
 * feedback, as it would depend on itself
 */
export function getCustomFeedbackCallDefinition(
	controlId: SomeControlId
): { connectionId: string; definitionId: string } | null {
	const parsedId = ParseControlId(controlId)
	if (parsedId?.type !== 'custom-feedback') return null

	return { connectionId: CUSTOM_CONNECTION_ID, definitionId: parsedId.customFeedbackId }
}

/**
 * The ids (`<connectionId>:<definitionId>`) of the custom feedbacks which can't be added to a control, as using them
 * there would come back to the custom feedback being edited: the custom feedback itself, and any which use it
 * @param controlId The control being edited, or null when it is not a control
 * @param customFeedbacks Each custom feedback, by its control id
 */
export function getCustomFeedbackCallsExcludedFrom(
	controlId: SomeControlId | null,
	customFeedbacks: Iterable<[CustomFeedbackControlId, Pick<ClientCustomFeedbackData, 'calledCustomFeedbackIds'>]>
): Set<string> {
	const excluded = new Set<string>()
	if (!controlId) return excluded

	const self = getCustomFeedbackCallDefinition(controlId)
	if (!self) return excluded

	excluded.add(`${self.connectionId}:${self.definitionId}`)
	for (const [otherControlId, info] of customFeedbacks) {
		const other = getCustomFeedbackCallDefinition(otherControlId)
		if (other && info.calledCustomFeedbackIds.includes(self.definitionId)) {
			excluded.add(`${other.connectionId}:${other.definitionId}`)
		}
	}

	return excluded
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
	/** The ids of every custom feedback it uses, directly or through others */
	calledCustomFeedbackIds: string[]
	/** The ids along a path of uses which comes back to it, starting with it, or null if there is none */
	callLoop: string[] | null
	/** Whether a chain of uses from it nests more deeply than is allowed */
	nestedTooDeep: boolean
}

/** A feedback which uses a custom feedback */
export interface CustomFeedbackUse {
	/** The control holding the feedback, which may be another custom feedback */
	readonly controlId: SomeControlId
	readonly entityId: string
	readonly disabled: boolean
}

export type CustomFeedbacksUpdate =
	| CustomFeedbacksUpdateInitOp
	| CustomFeedbacksUpdateAddOp
	| CustomFeedbacksUpdateRemoveOp
	| CustomFeedbacksUpdateUpdateOp

export interface CustomFeedbacksUpdateInitOp {
	type: 'init'
	customFeedbacks: Record<CustomFeedbackControlId, ClientCustomFeedbackData>
}
export interface CustomFeedbacksUpdateRemoveOp {
	type: 'remove'
	controlId: CustomFeedbackControlId
}
export interface CustomFeedbacksUpdateUpdateOp {
	type: 'update'
	controlId: CustomFeedbackControlId

	patch: ObjectPatch<ClientCustomFeedbackData>
}
export interface CustomFeedbacksUpdateAddOp {
	type: 'add'
	controlId: CustomFeedbackControlId

	info: ClientCustomFeedbackData
}
