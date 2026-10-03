import { prepare as fuzzyPrepare } from 'fuzzysort'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { useComputed } from '~/Resources/util.js'
import { fuzzyFilterSort } from '~/util/fuzzy.js'
import type { DropdownChoicesOrGroups } from '../DropdownChoices.js'
import type { DropdownChoiceWithMeta, DropdownGroupBase } from './Popup.js'

type FuzzyChoice = DropdownChoiceWithMeta & { fuzzy: ReturnType<typeof fuzzyPrepare> }
type FuzzyGroup = DropdownGroupBase & { items: FuzzyChoice[] }

/**
 * Either all choices, or all groups. base-ui decides which from the first entry, so the two must never be mixed
 */
type FuzzyItems = FuzzyChoice[] | FuzzyGroup[]

export type { FuzzyChoice, FuzzyGroup, FuzzyItems }

export function isGroupedFuzzyItems(items: FuzzyItems): items is FuzzyGroup[] {
	return items.length > 0 && 'items' in items[0]
}

/**
 * Converts raw choices into fuzzysort-prepared items.
 * When there are any groups, ungrouped choices are wrapped into unlabelled groups, so that the result is never mixed.
 * @param choices - The choices to prepare, may be a flat array, grouped array, or record.
 * @param searchLabelsOnly - When true, only the label is indexed for fuzzy search.
 *   When false, both label and id are concatenated so the id is also searchable.
 */
export function useFuzzyChoices(
	choices: DropdownChoicesOrGroups,
	searchLabelsOnly: boolean
): { allItems: FuzzyItems; flatItems: FuzzyChoice[] } {
	return useComputed(() => {
		const toFuzzy = (c: DropdownChoice): FuzzyChoice => ({
			id: c.id,
			label: String(c.label),
			fuzzy: fuzzyPrepare(searchLabelsOnly ? String(c.label) : `${String(c.label)} ${String(c.id)}`),
		})

		if (!Array.isArray(choices)) {
			const flatItems = typeof choices === 'object' ? Object.values(choices).map(toFuzzy) : []
			return { allItems: flatItems, flatItems }
		}

		if (!choices.some((item) => 'options' in item)) {
			const flatItems = (choices as DropdownChoice[]).map(toFuzzy)
			return { allItems: flatItems, flatItems }
		}

		const flatItems: FuzzyChoice[] = []
		const groups: FuzzyGroup[] = []
		let ungrouped: FuzzyGroup | null = null
		for (const item of choices) {
			if ('options' in item) {
				const opts = item.options.map(toFuzzy)
				groups.push({ id: String(item.label), label: String(item.label), items: opts })
				flatItems.push(...opts)
				ungrouped = null
			} else {
				if (!ungrouped) {
					ungrouped = { id: `__ungrouped_${groups.length}`, label: '', items: [] }
					groups.push(ungrouped)
				}
				const f = toFuzzy(item)
				ungrouped.items.push(f)
				flatItems.push(f)
			}
		}

		return { allItems: groups, flatItems }
	}, [choices, searchLabelsOnly])
}

/**
 * Add some choices before the items, in an unlabelled group if the items are grouped
 */
export function prependFuzzyChoices(items: FuzzyItems, choices: FuzzyChoice[]): FuzzyItems {
	if (choices.length === 0) return items
	if (isGroupedFuzzyItems(items)) return [{ id: '__prepended', label: '', items: choices }, ...items]
	return [...choices, ...items]
}

/**
 * Filter and sort the items by fuzzy match, dropping any groups left empty
 */
export function filterFuzzyItems(items: FuzzyItems, filter: string): FuzzyItems {
	if (!isGroupedFuzzyItems(items)) return fuzzyFilterSort(items, filter)

	const result: FuzzyGroup[] = []
	for (const group of items) {
		const filtered = fuzzyFilterSort(group.items, filter)
		if (filtered.length > 0) result.push({ ...group, items: filtered })
	}
	return result
}
