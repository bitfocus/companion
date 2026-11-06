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
	// Shared by every custom action, as calls which branch and join again lead to the same ones many times
	const knownChains = new Map<string, number>()

	for (const id of directCalls.keys()) {
		result.set(id, {
			calledIds: findCalledIds(directCalls, id),
			loop: findLoop(directCalls, id),
			tooDeep: longestChain(directCalls, id, new Set(), knownChains).length > MAX_CUSTOM_ACTION_DEPTH,
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

/**
 * The number of custom actions in the longest chain of calls from one, not following a loop
 * @param inChain The custom actions already in the chain leading to this one
 * @param knownChains The longest chain from those custom actions where it doesn't depend on the chain leading to them
 * @returns The length, and whether it depends on the chain leading to it, as it met a custom action already in it
 */
function longestChain(
	directCalls: ReadonlyMap<string, ReadonlySet<string>>,
	id: string,
	inChain: Set<string>,
	knownChains: Map<string, number>
): { length: number; dependsOnChain: boolean } {
	if (inChain.has(id)) return { length: 0, dependsOnChain: true }

	const known = knownChains.get(id)
	if (known !== undefined) return { length: known, dependsOnChain: false }

	inChain.add(id)
	let longest = 0
	let dependsOnChain = false
	let stoppedEarly = false
	for (const next of directCalls.get(id) ?? []) {
		const chain = longestChain(directCalls, next, inChain, knownChains)
		longest = Math.max(longest, chain.length)
		dependsOnChain ||= chain.dependsOnChain
		// Stop once it is clear the chain is too deep, as the number of chains through loops can grow quickly
		if (longest > MAX_CUSTOM_ACTION_DEPTH) {
			stoppedEarly = true
			break
		}
	}
	inChain.delete(id)

	// Without meeting the chain leading to it, it isn't part of a loop, so its longest chain is the same however it is
	// reached. One cut short has only been partly searched, so isn't known in full
	if (!dependsOnChain && !stoppedEarly) knownChains.set(id, longest + 1)

	return { length: longest + 1, dependsOnChain: dependsOnChain || stoppedEarly }
}
