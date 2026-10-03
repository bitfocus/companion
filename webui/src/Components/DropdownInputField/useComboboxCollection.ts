import { Combobox, type ComboboxItemCollection } from '@base-ui/react/combobox'
import { useMemo } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'

/**
 * Wrap the items in a base-ui collection, so that base-ui uses each item's id as its value.
 * Without this, base-ui treats the item objects themselves as the values.
 * The ids must be unique across all the items.
 */
export function useComboboxCollection<TItem extends DropdownChoice>(
	items: ReadonlyArray<TItem | { items: TItem[] }> | undefined,
	getLabel: (item: TItem) => string
): ComboboxItemCollection<TItem, DropdownChoiceId> {
	return useMemo(
		() =>
			Combobox.createItems<TItem, DropdownChoiceId>(items && toComboboxItems(items), {
				getValue: (item) => item.id,
				getLabel,
			}),
		[items, getLabel]
	)
}

/**
 * base-ui types the items as either all items or all groups, but we can have a mix of both.
 * At runtime it decides by the first entry, which is the behaviour we already rely on.
 */
export function toComboboxItems<TItem>(items: ReadonlyArray<TItem | { items: TItem[] }>): never {
	return items as never
}

export const getComboboxItemLabel = (item: DropdownChoice): string => String(item.label)
