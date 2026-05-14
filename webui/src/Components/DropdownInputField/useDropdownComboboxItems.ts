import { prepare as fuzzyPrepare, single as fuzzySingle } from 'fuzzysort'
import type { DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { useComputed } from '~/Resources/util.js'
import type { FuzzyChoice, FuzzyGroup } from './useFuzzyChoices.js'

interface UseDropdownComboboxItemsParams {
	allItems: Array<FuzzyChoice | FuzzyGroup>
	flatItems: FuzzyChoice[]
	localDisplayValue: DropdownChoiceId
	inputValue: string
	controlledInputValue: string | undefined
	allowCustom: boolean | undefined
	isValidCustom: (input: string) => boolean
	isEditingMode: boolean
}

interface UseDropdownComboboxItemsResult {
	currentItem: FuzzyChoice
	syntheticItem: FuzzyChoice | null
	effectiveItems: Array<FuzzyChoice | FuzzyGroup>
	filteredItems: Array<FuzzyChoice | FuzzyGroup>
}

export function useDropdownComboboxItems({
	allItems,
	flatItems,
	localDisplayValue,
	inputValue,
	controlledInputValue,
	allowCustom,
	isValidCustom,
	isEditingMode,
}: UseDropdownComboboxItemsParams): UseDropdownComboboxItemsResult {
	// Resolve the current value to a display item
	const currentItem = useComputed((): FuzzyChoice => {
		const entry = flatItems.find((o) => o.id == localDisplayValue) // Intentionally loose for compatibility
		if (entry) return entry
		const strValue = String(localDisplayValue)
		if (allowCustom) return { id: localDisplayValue, label: strValue, fuzzy: fuzzyPrepare(strValue) }
		if (localDisplayValue === '' || localDisplayValue === undefined || localDisplayValue === null)
			return { id: localDisplayValue, label: '', fuzzy: fuzzyPrepare('') }
		const unknownLabel = `?? (${strValue})`
		return { id: localDisplayValue, label: unknownLabel, fuzzy: fuzzyPrepare(unknownLabel) }
	}, [localDisplayValue, flatItems, allowCustom])

	// Synthetic "Use X" item — appears when the user has typed a value that passes regex
	// and doesn't exactly match any existing option.
	const syntheticItem = useComputed((): FuzzyChoice | null => {
		if (!allowCustom || !inputValue || !isValidCustom(inputValue)) return null
		if (flatItems.some((o) => o.id == inputValue)) return null
		return {
			id: inputValue,
			label: `Use "${inputValue}"`,
			fuzzy: fuzzyPrepare(inputValue),
			plusIndicator: true,
		}
	}, [allowCustom, inputValue, isValidCustom, flatItems])

	// Items for base-ui value resolution. Includes the synthetic item and, when the current
	// value is a custom/unknown entry, the current item itself so itemToStringLabel can find it.
	const effectiveItems = useComputed((): Array<FuzzyChoice | FuzzyGroup> => {
		const isCurrentKnown = flatItems.some((o) => o.id == localDisplayValue)
		const isSyntheticMatchesCurrent = syntheticItem != null && syntheticItem.id == localDisplayValue

		const prefixed: FuzzyChoice[] = []
		if (syntheticItem) prefixed.push(syntheticItem)
		// Ensure the current value is resolvable even when it's not in the choices list
		if (!isCurrentKnown && !isSyntheticMatchesCurrent) {
			prefixed.push(currentItem)
		}

		return [...prefixed, ...allItems]
	}, [syntheticItem, allItems, flatItems, localDisplayValue, currentItem])

	// Items displayed in the popup (excluding the hidden resolution entry for the current custom value)
	const filteredItems = useComputed((): Array<FuzzyChoice | FuzzyGroup> => {
		// In editing mode, when the input still shows the pre-filled raw value (user hasn't typed
		// anything different), show all options rather than filtering.
		const fuzzyInput =
			isEditingMode && controlledInputValue !== undefined && inputValue === String(localDisplayValue) ? '' : inputValue

		if (!fuzzyInput) return allItems

		const filterFlat = (items: FuzzyChoice[]): FuzzyChoice[] =>
			items.filter((o) => (fuzzySingle(fuzzyInput, o.fuzzy)?.score ?? 0) >= 0.5)

		const result: Array<FuzzyChoice | FuzzyGroup> = []
		for (const item of allItems) {
			if ('items' in item) {
				const filtered = filterFlat(item.items)
				if (filtered.length > 0) result.push({ ...item, items: filtered })
			} else {
				if ((fuzzySingle(fuzzyInput, item.fuzzy)?.score ?? 0) >= 0.5) result.push(item)
			}
		}

		if (syntheticItem) result.unshift(syntheticItem)
		return result
	}, [allItems, syntheticItem, inputValue, isEditingMode, controlledInputValue, localDisplayValue])

	return { currentItem, syntheticItem, effectiveItems, filteredItems }
}
