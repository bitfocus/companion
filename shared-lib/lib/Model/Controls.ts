import z from 'zod'
import { getControlIdKind, zodControlIds, type ControlIdKind, type ControlIdOfKind } from '../ControlId.js'
import type { ObjectPatch } from '../Diff.js'
import { SomeButtonModelSchema, type NormalButtonRuntimeProps } from './ButtonModel.js'
import { ExpressionVariableModelSchema } from './ExpressionVariableModel.js'
import type { LinkButtonRuntimeProps } from './Link.js'
import { PageControlModelSchema } from './PageControlModel.js'
import { TriggerModelSchema } from './TriggerModel.js'

export const SomeControlModelSchema = z.discriminatedUnion('type', [
	...SomeButtonModelSchema.options,
	TriggerModelSchema,
	ExpressionVariableModelSchema,
	PageControlModelSchema,
])

export type SomeControlModel = z.output<typeof SomeControlModelSchema>

/** The kind of control id each type of control is stored under */
const CONTROL_ID_KIND_FOR_TYPE = {
	pagenum: 'bank',
	pageup: 'bank',
	pagedown: 'bank',
	'button-layered': 'bank',
	'preset-reference': 'bank',
	'button-reference': 'bank',
	'link-button': 'bank',
	trigger: 'trigger',
	'expression-variable': 'expression-variable',
	page: 'page',
} as const satisfies Record<SomeControlModel['type'], ControlIdKind>

/** The kinds of control id that have a {@link SomeControlModel}. A preset is not a stored control */
export type StoredControlIdKind = (typeof CONTROL_ID_KIND_FOR_TYPE)[SomeControlModel['type']]
export type StoredControlId = ControlIdOfKind<StoredControlIdKind>

export const zodStoredControlId = z.union([
	zodControlIds.bank,
	zodControlIds.trigger,
	zodControlIds['expression-variable'],
	zodControlIds.page,
]) satisfies z.ZodType<StoredControlId>

type StoredControlIdKindOf<TId extends StoredControlId> = {
	[K in StoredControlIdKind]: TId extends ControlIdOfKind<K> ? K : never
}[StoredControlIdKind]

type ControlTypeOfKind<TKind extends StoredControlIdKind> = {
	[T in SomeControlModel['type']]: (typeof CONTROL_ID_KIND_FOR_TYPE)[T] extends TKind ? T : never
}[SomeControlModel['type']]

/** The models a control with this id can have */
export type ControlModelForId<TId extends StoredControlId> = Extract<
	SomeControlModel,
	{ type: ControlTypeOfKind<StoredControlIdKindOf<TId>> }
>

/** Whether a control model is one that the control id can have */
export function isControlModelForId<TId extends StoredControlId>(
	controlId: TId,
	config: SomeControlModel
): config is ControlModelForId<TId> {
	return CONTROL_ID_KIND_FOR_TYPE[config.type] === getControlIdKind(controlId)
}

/** The runtime props of a control that has none */
export type NoRuntimeProps = Record<string, never>

type AllControlTypes<T extends Record<SomeControlModel['type'], object>> = T

/** The properties each type of control sends to the ui that are not persisted in its config */
export type ControlRuntimePropsByType = AllControlTypes<{
	pagenum: NoRuntimeProps
	pageup: NoRuntimeProps
	pagedown: NoRuntimeProps
	'button-layered': NormalButtonRuntimeProps
	'preset-reference': NormalButtonRuntimeProps
	'button-reference': NoRuntimeProps
	'link-button': LinkButtonRuntimeProps
	trigger: NoRuntimeProps
	'expression-variable': NoRuntimeProps
	page: NoRuntimeProps
}>

export type SomeControlRuntimeProps = ControlRuntimePropsByType[SomeControlModel['type']]

/**
 * A control's config and runtime properties, as the ui sees them. `type` is the config's type, so that checking it
 * narrows both
 */
export type UIControlState<TModel extends SomeControlModel = SomeControlModel> = TModel extends SomeControlModel
	? {
			type: TModel['type']
			config: TModel
			runtime: ControlRuntimePropsByType[TModel['type']]
		}
	: never

export type UIControlUpdate =
	UIControlUpdateInit | UIControlUpdateConfig | UIControlUpdateRuntime | UIControlUpdateDestroy

export interface UIControlUpdateInit {
	type: 'init'

	control: UIControlState
}
export interface UIControlUpdateConfig {
	type: 'config'

	patch: ObjectPatch<SomeControlModel>
}
export interface UIControlUpdateRuntime {
	type: 'runtime'

	patch: ObjectPatch<SomeControlRuntimeProps>
}
export interface UIControlUpdateDestroy {
	type: 'destroy'
}
