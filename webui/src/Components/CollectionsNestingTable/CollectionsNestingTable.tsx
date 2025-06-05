import React from 'react'
import { capitalize } from 'lodash-es'
import { CollectionsNestingTableCollectionsList } from './CollectionsNestingTableGroupsList.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionsListItemDrop } from './useItemDrop.js'
import {
	CollectionsNestingTableContextProvider,
	CollectionsNestingTableContextType,
} from './CollectionsNestingTableContext.js'
import { CollectionsNestingTableCollectionContents } from './CollectionsNestingTableGroupContents.js'
import { observer } from 'mobx-react-lite'

interface CollectionsNestingTableProps<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
> extends CollectionsNestingTableContextType<TItem> {
	Heading?: React.ComponentType
	NoContent: React.ComponentType

	collections: TCollection[]
	items: TItem[]
}

export const CollectionsNestingTable = observer(function CollectionsNestingTable<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>({
	Heading,
	NoContent,
	ItemRow,
	itemName,
	dragId,
	collectionsApi,
	selectedItemId,

	collections,
	items,
}: CollectionsNestingTableProps<TCollection, TItem>) {
	const { groupedItems, ungroupedItems } = getGroupedItems(items, new Set(collections.map((g) => g.id)))

	const { isDragging } = useCollectionsListItemDrop(collectionsApi, dragId, null, null, 0) // Assuming null for root level collections

	return (
		<CollectionsNestingTableContextProvider
			ItemRow={ItemRow}
			itemName={itemName}
			collectionsApi={collectionsApi}
			dragId={dragId}
			selectedItemId={selectedItemId}
		>
			<div className="collections-nesting-table">
				{!!Heading && (
					<div className="collections-nesting-table-header">
						<Heading />
					</div>
				)}

				<CollectionsNestingTableCollectionsList
					collections={collections}
					parentId={null}
					groupedItems={groupedItems}
					nestingLevel={0}
				/>

				{(isDragging || ungroupedItems.length > 0) && collections.length > 0 && (
					<div className="collections-nesting-table-ungrouped-header">
						<span className="collection-name">Ungrouped {capitalize(itemName)}s</span>
					</div>
				)}

				<CollectionsNestingTableCollectionContents
					items={ungroupedItems}
					collectionId={null}
					showNoItemsMessage={false}
					nestingLevel={0}
				/>

				{items.length === 0 && (
					<div>
						<NoContent />
					</div>
				)}
			</div>
		</CollectionsNestingTableContextProvider>
	)
})

function getGroupedItems<TItem extends CollectionsNestingTableItem>(
	allItems: TItem[],
	validCollectionIds: Set<string>
) {
	const groupedItems = new Map<string, TItem[]>()
	const ungroupedItems: TItem[] = []

	// Initialize empty arrays for all groups
	for (const collectionId of validCollectionIds) {
		groupedItems.set(collectionId, [])
	}

	// Assign connections to their groups
	for (const item of allItems) {
		if (item.collectionId && validCollectionIds.has(item.collectionId)) {
			groupedItems.get(item.collectionId)!.push(item)
		} else {
			ungroupedItems.push(item)
		}
	}

	// Sort connections by sortOrder within each collection
	ungroupedItems.sort((a, b) => a.sortOrder - b.sortOrder)
	for (const items of groupedItems.values()) {
		items.sort((a, b) => a.sortOrder - b.sortOrder)
	}

	return {
		groupedItems,
		ungroupedItems,
	}
}
