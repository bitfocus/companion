// Flattened timeline data model, ported from the standalone Companion Timeline app.
//
// The standalone app projected Companion's action lists into a flat `{ action, delay }`
// model where consecutive `internal: wait` actions are collapsed into a `delay` offset on
// the following action. This module keeps that projection; `adapter.ts` converts to/from
// Companion v5's real entity model.

export type ExecutionMode = 'concurrent' | 'sequential' | 'inherit'

export interface CompanionAction {
	id: string
	action: string // == entity definitionId
	instance: string // == entity connectionId
	options: Record<string, unknown>
	delay: number
	disabled?: boolean
	// action_group: nested child actions keyed by set name (always "default")
	children?: Record<string, CompanionAction[]>
}

export interface ActionSets {
	down?: CompanionAction[]
	up?: CompanionAction[]
	rotate_left?: CompanionAction[]
	rotate_right?: CompanionAction[]
	[holdMs: string]: CompanionAction[] | undefined
}

export interface StepOptions {
	runWhileHeld?: number[]
	name?: string
}

export interface Step {
	action_sets: ActionSets
	options?: StepOptions
}

export interface ButtonStyle {
	text?: string
	size?: string | number
	image?: string | null
	color?: number
	bgcolor?: number
}

export interface ButtonControl {
	type: 'button'
	style: ButtonStyle
	steps: Record<string, Step>
}

export interface CompanionInstance {
	instance_type: string
	label: string
	enabled?: boolean
}

export interface PageInfo {
	name?: string
	id?: string
}

export interface CompanionConfig {
	controls: Record<string, ButtonControl>
	page?: Record<string, PageInfo>
	instances?: Record<string, CompanionInstance>
	gridSize?: { columns: number; rows: number }
}

export function intToColor(n: number): string {
	const hex = (n >>> 0).toString(16).padStart(6, '0')
	return `#${hex}`
}

// A trigger key (hold duration or named event) for a track row
export type TriggerKey = 'down' | 'up' | 'rotate_left' | 'rotate_right' | `${number}`

export function triggerLabel(key: TriggerKey): string {
	if (key === 'down') return 'Press'
	if (key === 'up') return 'Release'
	if (key === 'rotate_left') return 'Rotate ←'
	if (key === 'rotate_right') return 'Rotate →'
	const ms = parseInt(key)
	if (!isNaN(ms)) {
		if (ms >= 1000) return `Hold ${ms / 1000}s`
		return `Hold ${ms}ms`
	}
	return key
}

// The setId Companion uses for an action set: named triggers are strings, holds are numbers.
export function triggerKeyToSetId(key: TriggerKey): string | number {
	if (key === 'down' || key === 'up' || key === 'rotate_left' || key === 'rotate_right') return key
	const n = Number(key)
	return Number.isFinite(n) && String(n) === key ? n : key
}
