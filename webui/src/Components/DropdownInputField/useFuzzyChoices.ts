import { prepare as fuzzyPrepare } from 'fuzzysort'
import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import { useComputed } from '~/Resources/util.js'
import type { DropdownChoicesOrGroups } from '../DropdownChoices.js'
import type { DropdownChoiceWithMeta, DropdownGroupBase } from './Popup.js'

type FuzzyChoice = DropdownChoiceWithMeta & { fuzzy: ReturnType<typeof fuzzyPrepare> }
type FuzzyGroup = DropdownGroupBase & { items: FuzzyChoice[] }

export type { FuzzyChoice, FuzzyGroup }

/**
 * Converts raw choices into fuzzysort-prepared items.
 * @param choices - The choices to prepare, may be a flat array, grouped array, or record.
 * @param searchLabelsOnly - When true, only the label is indexed for fuzzy search.
 *   When false, both label and id are concatenated so the id is also searchable.
 */
export function useFuzzyChoices(
	choices: DropdownChoicesOrGroups,
	searchLabelsOnly: boolean
): { allItems: Array<FuzzyChoice | FuzzyGroup>; flatItems: FuzzyChoice[] } {
	return useComputed(() => {
		const flatItems: FuzzyChoice[] = []
		const allItems: Array<FuzzyChoice | FuzzyGroup> = []

		const toFuzzy = (c: DropdownChoice): FuzzyChoice => ({
			id: c.id,
			label: String(c.label),
			fuzzy: fuzzyPrepare(searchLabelsOnly ? String(c.label) : `${String(c.label)} ${String(c.id)}`),
		})

		if (Array.isArray(choices)) {
			for (const item of choices) {
				if ('options' in item) {
					const opts = item.options.map(toFuzzy)
					allItems.push({ id: String(item.label), label: String(item.label), items: opts })
					flatItems.push(...opts)
				} else {
					const f = toFuzzy(item)
					allItems.push(f)
					flatItems.push(f)
				}
			}
		} else if (typeof choices === 'object') {
			for (const choice of Object.values(choices)) {
				const f = toFuzzy(choice)
				allItems.push(f)
				flatItems.push(f)
			}
		}

		return { allItems, flatItems }
	}, [choices, searchLabelsOnly])
}
