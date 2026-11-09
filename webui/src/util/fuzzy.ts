import { go as fuzzyGo, single as fuzzySingle, type prepare as fuzzyPrepare, type Key } from 'fuzzysort'

/**
 * Filter and sort an array of items by fuzzy match score.
 * Items must have a `fuzzy` property pre-computed via fuzzysort's `prepare()`.
 */
export function fuzzyFilterSort<T extends { fuzzy: ReturnType<typeof fuzzyPrepare> }>(
	items: T[],
	filter: string,
	minScore = 0.5
): T[] {
	const scored = items.reduce<Array<{ item: T; score: number }>>((acc, item) => {
		const score = fuzzySingle(filter, item.fuzzy)?.score ?? -Infinity
		if (score >= minScore) acc.push({ item, score })
		return acc
	}, [])
	scored.sort((a, b) => b.score - a.score)
	return scored.map(({ item }) => item)
}

/**
 * Search objects by one or more keys, best match first.
 * @param threshold minimum score, 0 - 1
 * @param limit max results, 0 for unlimited
 */
export function fuzzySearchByKeys<T>(
	items: ReadonlyArray<T>,
	filter: string,
	keys: ReadonlyArray<Key<T>>,
	threshold: number,
	limit: number
): T[] {
	return fuzzyGo(filter, items, { keys, threshold, limit }).map((result) => result.obj)
}
