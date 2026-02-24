import Fuzzysort from 'fuzzysort'

// was -5k: hard to be exact but if -10k corresponds to 0.5, -5k is closer to 1; note that AddEntityDropdown.tsx uses 0.5
const FUZZY_THRESHOLD = 0.6

export function fuzzyMatch(searchQuery: string, ...targets: (string | string[] | undefined)[]): boolean {
	if (!searchQuery) return true

	for (const target of targets) {
		if (!target) continue

		if (Array.isArray(target)) {
			if (target.some((item) => (Fuzzysort.single(searchQuery, item)?.score ?? 0) > FUZZY_THRESHOLD)) {
				return true
			}
		} else {
			if ((Fuzzysort.single(searchQuery, target)?.score ?? 0) > FUZZY_THRESHOLD) {
				return true
			}
		}
	}

	return false
}
