import { single as fuzzySingle, type prepare as fuzzyPrepare } from 'fuzzysort'

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
