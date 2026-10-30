import { MAX_CUSTOM_ACTION_DEPTH } from '../CustomActionRunFrame.js'

/**
 * What a custom action ends up calling, through the custom actions it calls
 */
export interface CustomActionCallAnalysis {
	/** The ids of every custom action it calls, directly or through others */
	readonly calledIds: ReadonlySet<string>
	/** The ids along a path of calls which comes back to it, starting with it, or null if there is none */
	readonly loop: string[] | null
	/** Whether a chain of calls from it nests more than `MAX_CUSTOM_ACTION_DEPTH` deep */
	readonly tooDeep: boolean
}

/**
 * Work out what each custom action calls, to find the calls which would never run: those which loop back into a custom
 * action already running, and those nested too deeply. A run refuses both (see `CustomActionInstanceManager`), so this
 * is so the user can be told, or kept from making them.
 * @param directCalls The ids of the custom actions each custom action calls directly, by its id
 */
export function analyseCustomActionCalls(
	directCalls: ReadonlyMap<string, ReadonlySet<string>>
): Map<string, CustomActionCallAnalysis> {
	const result = new Map<string, CustomActionCallAnalysis>()

	for (const id of directCalls.keys()) {
		result.set(id, {
			calledIds: findCalledIds(directCalls, id),
			loop: findLoop(directCalls, id),
			tooDeep: longestChain(directCalls, id, new Set()) > MAX_CUSTOM_ACTION_DEPTH,
		})
	}

	return result
}

function findCalledIds(directCalls: ReadonlyMap<string, ReadonlySet<string>>, id: string): Set<string> {
	const found = new Set<string>()
	const pending = [...(directCalls.get(id) ?? [])]
	while (pending.length > 0) {
		const next = pending.pop()!
		if (found.has(next)) continue
		found.add(next)
		pending.push(...(directCalls.get(next) ?? []))
	}
	return found
}

/** The shortest path of calls from a custom action back to itself */
function findLoop(directCalls: ReadonlyMap<string, ReadonlySet<string>>, id: string): string[] | null {
	const previous = new Map<string, string>()
	const queue = [id]
	while (queue.length > 0) {
		const current = queue.shift()!
		for (const next of directCalls.get(current) ?? []) {
			if (next === id) {
				const path = [id]
				for (let step: string | undefined = current; step !== id && step !== undefined; step = previous.get(step)) {
					path.splice(1, 0, step)
				}
				path.push(id)
				return path
			}
			if (previous.has(next)) continue
			previous.set(next, current)
			queue.push(next)
		}
	}
	return null
}

/** The number of custom actions in the longest chain of calls from one, not following a loop */
function longestChain(directCalls: ReadonlyMap<string, ReadonlySet<string>>, id: string, inChain: Set<string>): number {
	if (inChain.has(id)) return 0

	inChain.add(id)
	let longest = 0
	for (const next of directCalls.get(id) ?? []) {
		// Stop once it is clear the chain is too deep, as the number of chains can grow quickly
		longest = Math.max(longest, longestChain(directCalls, next, inChain))
		if (longest > MAX_CUSTOM_ACTION_DEPTH) break
	}
	inChain.delete(id)

	return longest + 1
}
