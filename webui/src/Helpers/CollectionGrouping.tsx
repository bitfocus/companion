import type { DropdownChoice } from '@companion-app/shared/Model/Common.js'
import type { DropdownChoiceGroup } from '~/Components/index.js'
import type { CollectionBase } from '@companion-app/shared/Model/Collections.js'

/**
 * Groups items by their collection hierarchy into react-select compatible groups.
 * Items without a collectionId are placed in an "Ungrouped" group at the end.
 *
 * @param rootCollections - The top-level collections from the collection store
 * @param items - Array of items to group, each with a collectionId property
 * @param getItemChoice - Function to convert an item to a DropdownChoice
 * @param filterItem - Optional function to filter items (return false to exclude)
 * @param ungroupedLabel - Label for the ungrouped items group (default: "Ungrouped")
 * @returns Array of DropdownChoiceGroups, or flat array if no groups exist
 */
export function groupItemsByCollection<TItem extends { collectionId: string | null }>(
	rootCollections: CollectionBase<any>[],
	items: TItem[],
	getItemChoice: (item: TItem) => DropdownChoice,
	filterItem?: (item: TItem) => boolean,
	ungroupedLabel = 'Ungrouped'
): DropdownChoiceGroup[] | DropdownChoice[] {
	// Track which items have been assigned to collections
	const assignedItemIds = new Set<TItem>()

	/**
	 * Recursively builds a group for a collection and its direct children
	 */
	const buildGroupForCollection = (
		collection: CollectionBase<any>,
		parentPath: string[]
	): DropdownChoiceGroup | null => {
		const groupLabel = [...parentPath, collection.label || `Collection #${collection.id}`].join(' / ')
		const groupOptions: DropdownChoice[] = []

		// Add direct children items of this collection
		for (const item of items) {
			if (item.collectionId !== collection.id) continue
			if (filterItem && !filterItem(item)) continue
			groupOptions.push(getItemChoice(item))
			assignedItemIds.add(item)
		}

		// Only return a group if this collection has direct items
		if (groupOptions.length === 0) return null

		return { label: groupLabel, options: groupOptions }
	}

	/**
	 * Recursively collects all groups from a collection hierarchy
	 */
	const collectAllGroups = (
		collections: CollectionBase<any>[],
		parentPath: string[],
		result: DropdownChoiceGroup[]
	): void => {
		for (const collection of collections) {
			const group = buildGroupForCollection(collection, parentPath)
			if (group) result.push(group)

			// Also collect from nested children (they create their own composed labels)
			if (collection.children) {
				collectAllGroups(
					collection.children,
					[...parentPath, collection.label || `Collection #${collection.id}`],
					result
				)
			}
		}
	}

	// Collect all groups
	const allGroups: DropdownChoiceGroup[] = []
	collectAllGroups(rootCollections, [], allGroups)

	// Collect ungrouped items (not assigned to any collection)
	const ungrouped: DropdownChoice[] = []
	for (const item of items) {
		if (filterItem && !filterItem(item)) continue
		if (assignedItemIds.has(item)) continue
		ungrouped.push(getItemChoice(item))
	}

	// If no groups exist, return flat list
	if (allGroups.length === 0) {
		return ungrouped
	}

	// If there are ungrouped items, add them as a group at the end
	if (ungrouped.length > 0) {
		allGroups.push({ label: ungroupedLabel, options: ungrouped })
	}

	return allGroups
}
