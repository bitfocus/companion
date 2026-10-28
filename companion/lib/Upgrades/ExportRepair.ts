import type z from 'zod'
import { repairControl } from '../Controls/ControlRepair.js'

export interface ExportRepairResult {
	/** The export, with what failed repaired or dropped */
	obj: unknown
	/** A description of each repair or drop */
	repairs: string[]
}

/** How something in an export that failed is repaired */
type RepairKind =
	/** A control, trigger or expression variable: what failed in it is replaced by a placeholder, else it is dropped */
	| 'control'
	/** A list of entities: what failed in it is replaced by a placeholder, else the list is dropped */
	| 'entityList'
	/** An entry of a list: the property that failed is removed, so it is given its default, else it is dropped */
	| 'entry'
	/** A collection: like an entry, but its children take its place when it is dropped */
	| 'collection'

interface RepairTarget {
	kind: RepairKind
	/** The object or array holding it, and its key there */
	container: Record<PropertyKey, unknown>
	key: PropertyKey
	/** The path of the target in the export */
	path: PropertyKey[]
	/** Whether the export can do without it, else failing to repair it fails the import */
	droppable: boolean
	issues: z.core.$ZodIssue[]
}

/** The lists of an export, whose entries are repaired or dropped on their own */
const ENTRY_LISTS = new Set([
	'instances',
	'surfaceInstances',
	'custom_variables',
	'surfaces',
	'surfaceGroups',
	'surfacesRemote',
	'imageLibrary',
])

/** The parts of an export that can't be dropped */
const ENVELOPE = new Set(['type', 'version', 'page'])

/** The lists of controls of an export, which are repaired like a stored control */
const CONTROL_LISTS = new Set(['triggers', 'expressionVariables', 'customActions'])

/**
 * Repair an export that failed to parse, so that one invalid part doesn't fail the whole import: an entity or style
 * element of a control is replaced with a placeholder, an invalid property of anything else is removed so it is given
 * its default, and whatever still can't be parsed is dropped. Only an invalid envelope can't be repaired.
 * @returns the repaired export, or null if something failed that can't be repaired
 */
export function repairExport(obj: unknown, issues: readonly z.core.$ZodIssue[]): ExportRepairResult | null {
	const repaired: unknown = structuredClone(obj)

	const targets = new Map<string, RepairTarget>()
	for (const issue of issues) {
		const found = findTarget(repaired, issue.path)
		if (!found) return null

		const id = found.path.map(String).join('.')
		let target = targets.get(id)
		if (!target) {
			target = { ...found, issues: [] }
			targets.set(id, target)
		}
		target.issues.push({ ...issue, path: issue.path.slice(found.path.length) })
	}

	const repairs: string[] = []
	// Removed from their arrays afterwards, so that the indices of the others still match their issues
	const removed = new Map<unknown[], Map<number, unknown[]>>()

	// The deepest first, so that a target within another is repaired before the other is replaced
	const ordered = [...targets.entries()].sort(([, a], [, b]) => b.path.length - a.path.length)
	for (const [id, target] of ordered) {
		const value = target.container[target.key]

		const fixed = repairTarget(target, value)
		if (fixed) {
			target.container[target.key] = fixed.value
			repairs.push(...fixed.repairs.map((repair) => `${repair} of ${id}`))
			continue
		}

		if (!target.droppable) return null

		const replacement =
			target.kind === 'collection' && isRecord(value) && Array.isArray(value.children) ? value.children : []
		if (Array.isArray(target.container)) {
			let fromArray = removed.get(target.container)
			if (!fromArray) {
				fromArray = new Map()
				removed.set(target.container, fromArray)
			}
			fromArray.set(Number(target.key), replacement)
		} else {
			delete target.container[target.key]
		}

		repairs.push(
			replacement.length > 0
				? `Dropped ${id}, which couldn't be repaired, keeping its children`
				: `Dropped ${id}, which couldn't be repaired`
		)
	}

	for (const [array, replacements] of removed) {
		const kept = array.flatMap((item, index) => replacements.get(index) ?? [item])
		array.splice(0, array.length, ...kept)
	}

	return { obj: repaired, repairs }
}

function repairTarget(target: RepairTarget, value: unknown): { value: unknown; repairs: string[] } | null {
	switch (target.kind) {
		case 'control': {
			const result = repairControl(value, target.issues)
			return result && { value: result.control, repairs: result.repairs }
		}
		case 'entityList': {
			// Repaired as the local variables of a control, which they are
			const result = repairControl(
				{ localVariables: value },
				target.issues.map((issue) => ({ ...issue, path: ['localVariables', ...issue.path] }))
			)
			return (
				result && { value: (result.control as { localVariables: unknown }).localVariables, repairs: result.repairs }
			)
		}
		case 'entry':
		case 'collection':
			return removeInvalidProperties(value, target.issues)
	}
}

/**
 * Remove the property each issue is in, at the deepest level it can be removed from an object, so that it is given its
 * default or left out
 * @returns null if an issue isn't in a property that is there to be removed, such as a missing required one
 */
function removeInvalidProperties(
	value: unknown,
	issues: readonly z.core.$ZodIssue[]
): { value: unknown; repairs: string[] } | null {
	if (!isPlainObject(value)) return null

	const repairs: string[] = []
	for (const issue of issues) {
		// The deepest object holding a property along the issue's path
		let holder: Record<string, unknown> | null = null
		let property: string | null = null
		let current: unknown = value
		for (const key of issue.path) {
			if (!isPlainObject(current) || typeof key !== 'string' || !(key in current)) break
			holder = current
			property = key
			current = current[key]
		}
		if (!holder || property === null) return null

		delete holder[property]
		repairs.push(`Removed the invalid ${issue.path.map(String).join('.')}`)
	}

	return { value, repairs }
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return !!value && typeof value === 'object'
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return isRecord(value) && !Array.isArray(value)
}

/** Find the part of an export an issue is in, and how to repair it */
function findTarget(obj: unknown, path: readonly PropertyKey[]): Omit<RepairTarget, 'issues'> | null {
	const at = (length: number, kind: RepairKind, droppable: boolean): Omit<RepairTarget, 'issues'> | null => {
		if (path.length < length) return null
		const container = path
			.slice(0, length - 1)
			.reduce<unknown>((value, key) => (isRecord(value) ? value[key as string] : undefined), obj)
		if (!isRecord(container)) return null
		return { kind, container, key: path[length - 1], path: path.slice(0, length), droppable }
	}

	const [section] = path
	if (typeof section !== 'string') return null

	// A whole section that is invalid is dropped, except those that make up the envelope
	if (path.length === 1) {
		if (ENVELOPE.has(section) || !isRecord(obj)) return null
		return { kind: 'entry', container: obj, key: section, path: [section], droppable: true }
	}

	// A page of a full export, or the page of a page export
	if (section === 'pages' || section === 'page') {
		const pageLength = section === 'pages' ? 2 : 1
		const field = path[pageLength]
		if (field === 'controls' && path.length >= pageLength + 3) return at(pageLength + 3, 'control', true)
		if (field === 'pageVariables' && path.length > pageLength + 1) return at(pageLength + 1, 'entityList', true)
		// A page of a full export can be dropped, but not the page of a page export
		return at(pageLength, 'entry', section === 'pages')
	}

	if (CONTROL_LISTS.has(section)) return at(2, 'control', true)
	if (ENTRY_LISTS.has(section)) return at(2, 'entry', true)

	if (section.endsWith('Collections')) {
		// The deepest collection the issue is in, through the children of each
		let length = 2
		while (path[length] === 'children' && typeof path[length + 1] === 'number') length += 2
		return at(length, 'collection', true)
	}

	return null
}
