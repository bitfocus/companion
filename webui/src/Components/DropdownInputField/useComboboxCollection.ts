import { Combobox, type ComboboxItemCollection } from '@base-ui/react/combobox'
import { useMemo } from 'react'
import type { DropdownChoice, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'

/**
 * Wrap the items in a base-ui collection, so that base-ui uses each item's id as its value.
 * Without this, base-ui treats the item objects themselves as the values.
 * The ids must be unique across all the items.
 */
export function useComboboxCollection<TItem extends DropdownChoice>(
	items: readonly TItem[] | ReadonlyArray<{ items: TItem[] }> | undefined,
	getLabel: (item: NoInfer<TItem>) => string
): ComboboxItemCollection<TItem, DropdownChoiceId> {
	return useMemo(
		() =>
			// The cast is needed as createItems can't check a generic TItem isn't group shaped
			Combobox.createItems<TItem, DropdownChoiceId>(
				items as Parameters<typeof Combobox.createItems<TItem, DropdownChoiceId>>[0],
				{
					getValue: (item) => item.id,
					getLabel,
				}
			),
		[items, getLabel]
	)
}

export const getComboboxItemLabel = (item: DropdownChoice): string => String(item.label)
