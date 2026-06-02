// Translation between Companion v5's entity model and the flat timeline model.
//
// Ported from the standalone Companion Timeline app's main.cjs
// (`processActionsFromCompanion` / `processActionsToCompanion`). In v5 there is no
// per-action `delay`: gaps are explicit `internal: wait` action entities. Reading, we
// collapse `wait` entities into a `delay` offset on the following action; writing, we
// re-insert `wait` entities for the gaps between consecutive action delays.

import { nanoid } from 'nanoid'
import type { SomeButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import {
	EntityModelType,
	type ActionEntityModel,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ActionSets, ButtonControl, CompanionAction, Step } from './types.js'

const WAIT_TIME_OPTION = 'time'

function isWait(e: SomeEntityModel): boolean {
	return e.type === EntityModelType.Action && e.connectionId === 'internal' && e.definitionId === 'wait'
}
function isActionGroup(e: SomeEntityModel | CompanionAction): boolean {
	const conn = 'connectionId' in e ? e.connectionId : e.instance
	const def = 'definitionId' in e ? e.definitionId : e.action
	return conn === 'internal' && def === 'action_group'
}

// Companion stores option values as { isExpression, value } pairs. The flat model uses raw values.
function flattenOptions(opts: Record<string, any> | undefined): Record<string, unknown> {
	const out: Record<string, unknown> = {}
	for (const [k, v] of Object.entries(opts ?? {})) {
		out[k] = v !== null && typeof v === 'object' && 'value' in v ? v.value : v
	}
	return out
}

function optionTime(e: SomeEntityModel): number {
	const raw = (e.options as Record<string, any>)?.[WAIT_TIME_OPTION]
	const v = raw !== null && typeof raw === 'object' && 'value' in raw ? raw.value : raw
	const n = Number(v)
	return isNaN(n) ? 0 : n
}

// ── Read: v5 entities → flat actions ────────────────────────────────────────

export function entitiesToFlatActions(entities: SomeEntityModel[] | undefined): CompanionAction[] {
	let accMs = 0
	const result: CompanionAction[] = []
	for (const e of entities ?? []) {
		if (e.type !== EntityModelType.Action) continue
		if (isWait(e)) {
			accMs += optionTime(e)
			continue
		}
		if (isActionGroup(e)) {
			const children: Record<string, CompanionAction[]> = {}
			for (const [setKey, kids] of Object.entries(e.children ?? {})) {
				children[setKey] = entitiesToFlatActions(kids)
			}
			result.push({
				id: e.id,
				action: e.definitionId,
				instance: e.connectionId,
				options: flattenOptions(e.options),
				delay: accMs,
				disabled: e.disabled,
				children,
			})
			accMs = 0
			continue
		}
		result.push({
			id: e.id,
			action: e.definitionId,
			instance: e.connectionId,
			options: flattenOptions(e.options),
			delay: accMs,
			disabled: e.disabled,
		})
		accMs = 0
	}
	return result
}

// ── Write: flat actions → v5 entities ───────────────────────────────────────

function wrapOptions(
	flat: Record<string, unknown> | undefined
): Record<string, { value: unknown; isExpression: boolean }> {
	const out: Record<string, { value: unknown; isExpression: boolean }> = {}
	for (const [k, v] of Object.entries(flat ?? {})) {
		out[k] = v !== null && typeof v === 'object' && 'value' in v ? (v as any) : { value: v, isExpression: false }
	}
	return out
}

function makeWaitEntity(ms: number): ActionEntityModel {
	return {
		type: EntityModelType.Action,
		id: nanoid(),
		connectionId: 'internal',
		definitionId: 'wait',
		options: { [WAIT_TIME_OPTION]: { value: String(ms), isExpression: false } },
		upgradeIndex: undefined,
	}
}

export function flatActionsToEntities(actions: CompanionAction[]): SomeEntityModel[] {
	const sorted = [...actions]
		.filter((a) => a.instance && a.action) // skip blank/incomplete actions
		.sort((a, b) => (a.delay || 0) - (b.delay || 0))
	const result: SomeEntityModel[] = []
	let prevMs = 0
	for (const a of sorted) {
		const gap = (a.delay || 0) - prevMs
		if (gap > 0) result.push(makeWaitEntity(gap))

		if (isActionGroup(a)) {
			const children: Record<string, SomeEntityModel[]> = {}
			for (const [setKey, kids] of Object.entries(a.children ?? {})) {
				children[setKey] = flatActionsToEntities(kids ?? [])
			}
			result.push({
				type: EntityModelType.Action,
				id: a.id,
				connectionId: 'internal',
				definitionId: 'action_group',
				options: wrapOptions(a.options) as any,
				upgradeIndex: undefined,
				children,
				...(a.disabled != null ? { disabled: a.disabled } : {}),
			})
		} else {
			result.push({
				type: EntityModelType.Action,
				id: a.id,
				connectionId: a.instance,
				definitionId: a.action,
				options: wrapOptions(a.options) as any,
				upgradeIndex: undefined,
				...(a.disabled != null ? { disabled: a.disabled } : {}),
			})
		}
		prevMs = a.delay || 0
	}
	return result
}

// ── Whole-control conversion (read) ─────────────────────────────────────────

const TEXT_LAYER_TYPES = new Set(['text'])

function extractStyle(model: SomeButtonModel): ButtonControl['style'] {
	if (model.type !== 'button-layered') return {}
	const layers = (model.style?.layers ?? []) as any[]
	const textLayer = layers.find((l) => TEXT_LAYER_TYPES.has(l?.type))
	const boxLayer = layers.find((l) => l?.type === 'box')
	const unwrap = (v: any) => (v !== null && typeof v === 'object' && 'value' in v ? v.value : v)
	return {
		text: unwrap(textLayer?.text) ?? '',
		color: unwrap(textLayer?.color) ?? 0xffffff,
		bgcolor: unwrap(boxLayer?.color) ?? 0,
		size: 'auto',
	}
}

export function buttonModelToFlat(model: SomeButtonModel | null | undefined): ButtonControl | null {
	if (!model || model.type !== 'button-layered') return null
	const steps: Record<string, Step> = {}
	for (const [stepKey, step] of Object.entries(model.steps ?? {})) {
		if (!step) continue
		const action_sets: ActionSets = {}
		for (const [setId, entities] of Object.entries(step.action_sets ?? {})) {
			action_sets[setId] = entitiesToFlatActions(entities)
		}
		steps[stepKey] = { action_sets, options: step.options }
	}
	return { type: 'button', style: extractStyle(model), steps }
}
