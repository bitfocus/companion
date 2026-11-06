import z from 'zod'
import { CUSTOM_ACTIONS_CONNECTION_ID } from '../ConnectionId.js'
import { ParseControlId, type CustomActionControlId, type SomeControlId } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import type { CollectionBase } from './Collections.js'
import { SomeEntityModelSchema } from './EntityModel.js'
import { AuthorableInputFieldSchema, INPUT_FIELD_ID_PATTERN, isAuthorableFieldId } from './Options.js'

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
	controlId: SomeControlId
): { connectionId: string; definitionId: string } | null {
	const parsedId = ParseControlId(controlId)
	if (parsedId?.type !== 'custom-action') return null

	return { connectionId: CUSTOM_ACTIONS_CONNECTION_ID, definitionId: parsedId.customActionId }
}

/**
 * The ids (`<connectionId>:<definitionId>`) of the custom actions which can't be added to a control, as running them
 * there would come back to the custom action being edited: the custom action itself, and any which call it
 * @param controlId The control being edited, or null when it is not a control
 * @param customActions Each custom action, by its control id
 */
export function getCustomActionCallsExcludedFrom(
	controlId: SomeControlId | null,
	customActions: Iterable<[CustomActionControlId, Pick<ClientCustomActionData, 'calledCustomActionIds'>]>
): Set<string> {
	const excluded = new Set<string>()
	if (!controlId) return excluded

	const self = getCustomActionCallDefinition(controlId)
	if (!self) return excluded

	excluded.add(`${self.connectionId}:${self.definitionId}`)
	for (const [otherControlId, info] of customActions) {
		const other = getCustomActionCallDefinition(otherControlId)
		if (other && info.calledCustomActionIds.includes(self.definitionId)) {
			excluded.add(`${other.connectionId}:${other.definitionId}`)
		}
	}

	return excluded
}

/**
 * An output of a custom action: one of its local variables, whose value is written to wherever the action which
 * calls it chooses, each time it is set during a run
 */
export const CustomActionOutputSchema = z.object({
	/** Used by the actions which call the custom action to say where the output goes */
	id: z.string().regex(INPUT_FIELD_ID_PATTERN).refine(isAuthorableFieldId, "Id can't be used in a variable"),
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
	/** The ids of every custom action it calls, directly or through others */
	calledCustomActionIds: string[]
	/** The ids along a path of calls which comes back to it, starting with it, or null if there is none */
	callLoop: string[] | null
	/** Whether a chain of calls from it nests more deeply than is allowed */
	nestedTooDeep: boolean
}

/** A run of a custom action which is in progress */
export interface CustomActionRunInfo {
	readonly runId: string
	/** The control running it. For a run inside another custom action, the control which started the outer run */
	readonly controlId: SomeControlId
	/** When it started, as a unix timestamp in ms */
	readonly startedAt: number
}

/** An action which calls a custom action, and its runs in progress */
export interface CustomActionUse {
	/** The control holding the action, which may be another custom action */
	readonly controlId: SomeControlId
	readonly entityId: string
	readonly disabled: boolean
	readonly runs: CustomActionRunInfo[]
}

/** What calls a custom action, and what is running it */
export interface CustomActionUsage {
	readonly uses: CustomActionUse[]
	/** Runs whose calling action no longer exists, such as one removed part way through a run */
	readonly otherRuns: CustomActionRunInfo[]
}

/** The properties of a custom action sent to the ui which are not persisted */
export interface CustomActionRuntimeProps {
	/** Whether a test run, started from the editor, is running */
	testRunning: boolean
}

export type CustomActionsUpdate =
	CustomActionsUpdateInitOp | CustomActionsUpdateAddOp | CustomActionsUpdateRemoveOp | CustomActionsUpdateUpdateOp

export interface CustomActionsUpdateInitOp {
	type: 'init'
	customActions: Record<CustomActionControlId, ClientCustomActionData>
}
export interface CustomActionsUpdateRemoveOp {
	type: 'remove'
	controlId: CustomActionControlId
}
export interface CustomActionsUpdateUpdateOp {
	type: 'update'
	controlId: CustomActionControlId

	patch: ObjectPatch<ClientCustomActionData>
}
export interface CustomActionsUpdateAddOp {
	type: 'add'
	controlId: CustomActionControlId

	info: ClientCustomActionData
}
