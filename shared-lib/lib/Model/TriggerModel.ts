import z from 'zod'
import type { TriggerControlId } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import type { CollectionBase, EnabledCollectionData } from './Collections.js'
import { SomeEntityModelSchema } from './EntityModel.js'
import { EventInstanceSchema } from './EventModel.js'

export const TriggerOptionsSchema = z.object({
	name: z.string().default('New Trigger'),
	enabled: z.boolean().default(false),
	sortOrder: z.number().default(0),
	collectionId: z.string().optional(),
	notes: z.string().optional(),
})

export type TriggerOptions = z.output<typeof TriggerOptionsSchema>

export const TriggerModelSchema = z.object({
	type: z.literal('trigger'),
	options: TriggerOptionsSchema.default(() => TriggerOptionsSchema.parse({})),

	actions: z.array(SomeEntityModelSchema).default(() => []),
	condition: z.array(SomeEntityModelSchema).default(() => []),
	events: z.array(EventInstanceSchema).default(() => []),

	localVariables: z.array(SomeEntityModelSchema).default(() => []),
})

export type TriggerModel = z.output<typeof TriggerModelSchema>

export interface ClientTriggerData extends TriggerOptions {
	type: 'trigger'
	lastExecuted: number | null
	description: string
	collectionEnabled?: boolean
	/**
	 * Whether this trigger is currently being rate-limited because it is firing too rapidly
	 * from variable changes (e.g. an accidental feedback loop). Best-effort UI hint.
	 */
	isRateLimited?: boolean
}

export type TriggersUpdate =
	TriggersUpdateInitOp | TriggersUpdateRemoveOp | TriggersUpdateAddOp | TriggersUpdateUpdateOp

export interface TriggersUpdateInitOp {
	type: 'init'
	triggers: Record<TriggerControlId, ClientTriggerData>
}

export interface TriggersUpdateRemoveOp {
	type: 'remove'
	controlId: TriggerControlId
}
export interface TriggersUpdateAddOp {
	type: 'add'
	controlId: TriggerControlId

	info: ClientTriggerData
}
export interface TriggersUpdateUpdateOp {
	type: 'update'
	controlId: TriggerControlId

	patch: ObjectPatch<ClientTriggerData>
}

export type TriggerCollectionData = EnabledCollectionData

export type TriggerCollection = CollectionBase<TriggerCollectionData>
