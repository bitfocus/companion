import Fuzzysort from 'fuzzysort'

const FUZZY_THRESHOLD = -5000

export function fuzzyMatch(searchQuery: string, ...targets: (string | string[] | undefined)[]): boolean {
	if (!searchQuery) return true

	for (const target of targets) {
		if (!target) continue

		if (Array.isArray(target)) {
			if (target.some((item) => (Fuzzysort.single(searchQuery, item)?.score ?? -Infinity) > FUZZY_THRESHOLD)) {
				return true
			}
		} else {
			if ((Fuzzysort.single(searchQuery, target)?.score ?? -Infinity) > FUZZY_THRESHOLD) {
				return true
			}
		}
	}

	return false
}
