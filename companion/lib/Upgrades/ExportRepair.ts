import type z from 'zod'
import { repairControl } from '../Controls/ControlRepair.js'

export interface ExportRepairResult {
	/** The export, with what failed repaired or skipped */
	obj: unknown
	/** A description of each repair or skip */
	repairs: string[]
}

/** Something in an export that is repaired as a whole, by where it is and what it is */
interface RepairTarget {
	/** The object or array holding it, and its key there */
	container: Record<PropertyKey, unknown>
	key: PropertyKey
	/** The path of the target in the export */
	path: PropertyKey[]
	/** A list of entities, rather than a control */
	isEntityList: boolean
	issues: z.core.$ZodIssue[]
}

/**
 * Repair an export that failed to parse, like a stored control: an entity or style element that failed is replaced
 * with a placeholder, and a control, trigger or expression variable which still can't be parsed is skipped, rather
 * than failing the whole import
 * @returns the repaired export, or null if something failed that isn't in one of those
 */
export function repairExport(obj: unknown, issues: readonly z.core.$ZodIssue[]): ExportRepairResult | null {
	const repaired: any = structuredClone(obj)

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
	for (const [id, target] of targets) {
		const value = target.container[target.key]

		if (target.isEntityList) {
			// Repaired as the local variables of a control, which they are
			const result = repairControl(
				{ localVariables: value },
				target.issues.map((issue) => ({ ...issue, path: ['localVariables', ...issue.path] }))
			)
			if (result) {
				target.container[target.key] = (result.control as { localVariables: unknown }).localVariables
				repairs.push(...result.repairs.map((repair) => `${repair} of ${id}`))
			} else {
				delete target.container[target.key]
				repairs.push(`Skipped ${id}, which couldn't be repaired`)
			}
			continue
		}

		const result = repairControl(value, target.issues)
		if (result) {
			target.container[target.key] = result.control
			repairs.push(...result.repairs.map((repair) => `${repair} of ${id}`))
		} else {
			delete target.container[target.key]
			repairs.push(`Skipped ${id}, which couldn't be repaired`)
		}
	}

	return { obj: repaired, repairs }
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
	return !!value && typeof value === 'object'
}

/** Find the control, trigger, expression variable or page variables an issue is in */
function findTarget(obj: unknown, path: readonly PropertyKey[]): Omit<RepairTarget, 'issues'> | null {
	const at = (length: number): Omit<RepairTarget, 'issues'> | null => {
		if (path.length < length) return null
		const containerPath = path.slice(0, length - 1)
		const container = containerPath.reduce<unknown>(
			(value, key) => (isRecord(value) ? value[key as string] : undefined),
			obj
		)
		if (!isRecord(container)) return null
		return { container, key: path[length - 1], path: path.slice(0, length), isEntityList: false }
	}

	// A page of a full export, or the page of a page export
	const pagePrefix = path[0] === 'pages' ? 2 : path[0] === 'page' ? 1 : null
	if (pagePrefix !== null) {
		if (path[pagePrefix] === 'controls') return at(pagePrefix + 3)
		if (path[pagePrefix] === 'pageVariables') {
			const target = at(pagePrefix + 1)
			return target && { ...target, isEntityList: true }
		}
		return null
	}

	if (path[0] === 'triggers' || path[0] === 'expressionVariables') return at(2)

	return null
}
