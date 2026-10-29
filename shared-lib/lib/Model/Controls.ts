import z from 'zod'
import type { ObjectPatch } from '../Diff.js'
import { SomeButtonModelSchema } from './ButtonModel.js'
import { ExpressionVariableModelSchema } from './ExpressionVariableModel.js'
import { PageControlModelSchema } from './PageControlModel.js'
import { TriggerModelSchema } from './TriggerModel.js'

export const SomeControlModelSchema = z.discriminatedUnion('type', [
	...SomeButtonModelSchema.options,
	TriggerModelSchema,
	ExpressionVariableModelSchema,
	PageControlModelSchema,
])

export type SomeControlModel = z.output<typeof SomeControlModelSchema>

export type UIControlUpdate =
	UIControlUpdateInit | UIControlUpdateConfig | UIControlUpdateRuntime | UIControlUpdateDestroy

export interface UIControlUpdateInit {
	type: 'init'

	config: SomeControlModel
	runtime: Record<string, any>
}
export interface UIControlUpdateConfig {
	type: 'config'

	patch: ObjectPatch<SomeControlModel>
}
export interface UIControlUpdateRuntime {
	type: 'runtime'

	patch: ObjectPatch<Record<string, any>>
}
export interface UIControlUpdateDestroy {
	type: 'destroy'
}
