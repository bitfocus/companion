import type { Operation as JsonPatchOperation } from 'fast-json-patch'
import type { SomeButtonModel } from './ButtonModel.js'
import type { TriggerModel } from './TriggerModel.js'

export type SomeControlModel = SomeButtonModel | TriggerModel

export type UIControlUpdate =
	| UIControlUpdateInit
	| UIControlUpdateConfig
	| UIControlUpdateRuntime
	| UIControlUpdateDestroy

export interface UIControlUpdateInit {
	type: 'init'

	config: SomeControlModel
	runtime: Record<string, any>
}
export interface UIControlUpdateConfig {
	type: 'config'

	patch: JsonPatchOperation<SomeControlModel>[]
}
export interface UIControlUpdateRuntime {
	type: 'runtime'

	patch: JsonPatchOperation<Record<string, any>>[]
}
export interface UIControlUpdateDestroy {
	type: 'destroy'
}
