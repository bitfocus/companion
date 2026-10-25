import { nanoid } from 'nanoid'
import type { JsonValue } from 'type-fest'
import type z from 'zod'
import { EntityModelType, INVALID_ENTITY_DEFINITION_ID } from '@companion-app/shared/Model/EntityModel.js'

/** The lists of feedbacks in a control, by the key they are stored under */
const FEEDBACK_LIST_KEYS = new Set(['feedbacks', 'localVariables', 'condition'])

/** What a node reached while walking an issue's path is */
type NodeKind =
	'other' | 'entity' | 'element' | 'actionSets' | 'entityChildren' | 'actionList' | 'feedbackList' | 'elementList'

interface RepairTarget {
	container: Record<PropertyKey, unknown> | unknown[]
	key: PropertyKey
	kind: 'entity' | 'element'
	entityType: EntityModelType
	path: PropertyKey[]
}

export interface ControlRepairResult {
	/** The control, with what failed replaced */
	control: unknown
	/** A description of each replacement made */
	repairs: string[]
}

/**
 * Repair a stored control that failed to parse, by replacing each entity or style element that failed with a
 * placeholder, rather than losing the whole control. An entity is replaced by a disabled internal placeholder which
 * keeps the original, as it was stored, in its options; an element by an empty, disabled group.
 * @returns the repaired control, or null if something failed that isn't in an entity or element
 */
export function repairControl(control: unknown, issues: readonly z.core.$ZodIssue[]): ControlRepairResult | null {
	const repaired = structuredClone(control)

	// The nearest entity or element containing each issue
	const targets: RepairTarget[] = []
	for (const issue of issues) {
		const target = findRepairTarget(repaired, issue.path)
		if (!target) return null
		targets.push(target)
	}

	const repairs: string[] = []
	const replaced = new Set<string>()
	for (const target of targets) {
		// Replacing something replaces all it contains, so skip a target within another
		const containedByAnother = targets.some(
			(other) => other.path.length < target.path.length && isPrefix(other.path, target.path)
		)
		const id = target.path.map(String).join('.')
		if (containedByAnother || replaced.has(id)) continue
		replaced.add(id)

		const original = (target.container as Record<PropertyKey, unknown>)[target.key]
		;(target.container as Record<PropertyKey, unknown>)[target.key] =
			target.kind === 'entity'
				? createEntityPlaceholder(original, target.entityType)
				: createElementPlaceholder(original)
		repairs.push(`Replaced the ${target.kind === 'entity' ? target.entityType : 'style element'} at ${id}`)
	}

	return { control: repaired, repairs }
}

function isPrefix(prefix: PropertyKey[], path: PropertyKey[]): boolean {
	return prefix.every((key, index) => String(path[index]) === String(key))
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Walk the path of an issue, to the nearest entity or element containing it */
function findRepairTarget(control: unknown, path: readonly PropertyKey[]): RepairTarget | null {
	let found: RepairTarget | null = null

	let value: unknown = control
	let kind: NodeKind = 'other'
	for (let i = 0; i < path.length; i++) {
		const key = path[i]
		let nextKind: NodeKind = 'other'

		if (Array.isArray(value)) {
			if (typeof key === 'number' && (kind === 'actionList' || kind === 'feedbackList' || kind === 'elementList')) {
				const isElement: boolean = kind === 'elementList'
				found = {
					container: value,
					key,
					kind: isElement ? 'element' : 'entity',
					entityType: entityTypeOf(value[key], kind === 'actionList'),
					path: path.slice(0, i + 1),
				}
				nextKind = isElement ? 'element' : 'entity'
			}
		} else if (isRecord(value)) {
			if (i === 0 && key === 'entity') {
				// The single entity of an expression variable
				found = { container: value, key, kind: 'entity', entityType: EntityModelType.Feedback, path: [key] }
				nextKind = 'entity'
			} else if (kind === 'entity') {
				if (key === 'children') nextKind = 'entityChildren'
			} else if (kind === 'element') {
				if (key === 'children') nextKind = 'elementList'
			} else if (kind === 'entityChildren') {
				// Each group of children may be actions or feedbacks; an action unless the entity says otherwise
				nextKind = 'actionList'
			} else if (kind === 'actionSets') {
				// Each set of actions, keyed by its name or hold duration
				nextKind = 'actionList'
			} else if (key === 'layers') {
				nextKind = 'elementList'
			} else if (key === 'action_sets') {
				nextKind = 'actionSets'
			} else if (key === 'actions') {
				nextKind = 'actionList'
			} else if (typeof key === 'string' && FEEDBACK_LIST_KEYS.has(key)) {
				nextKind = 'feedbackList'
			}
		} else {
			break
		}

		value = (value as Record<PropertyKey, unknown>)[key]
		kind = nextKind
	}

	return found
}

function entityTypeOf(item: unknown, isAction: boolean): EntityModelType {
	const type = isRecord(item) ? item.type : undefined
	if (type === EntityModelType.Action || type === EntityModelType.Feedback) return type
	return isAction ? EntityModelType.Action : EntityModelType.Feedback
}

function idOf(original: unknown): string {
	return isRecord(original) && typeof original.id === 'string' && original.id ? original.id : nanoid()
}

function createEntityPlaceholder(original: unknown, type: EntityModelType): Record<string, unknown> {
	return {
		type,
		id: idOf(original),
		connectionId: 'internal',
		definitionId: INVALID_ENTITY_DEFINITION_ID,
		headline: headlineOf(original),
		disabled: true,
		options: {
			original: { isExpression: false, value: (original ?? null) as JsonValue },
		},
	}
}

/** Say it is broken, with its note, else what it was */
function headlineOf(original: unknown): string {
	const prefix = "Couldn't be loaded"
	if (!isRecord(original)) return prefix
	if (typeof original.headline === 'string' && original.headline) return `${prefix} - ${original.headline}`
	if (typeof original.connectionId === 'string' && typeof original.definitionId === 'string') {
		return `${prefix} - ${original.connectionId}: ${original.definitionId}`
	}
	return prefix
}

function createElementPlaceholder(original: unknown): Record<string, unknown> {
	const name = isRecord(original) && typeof original.name === 'string' && original.name ? original.name : 'element'
	return {
		type: 'group',
		id: idOf(original),
		name: `Invalid - ${name}`,
		enabled: { isExpression: false, value: false },
		children: [],
	}
}
