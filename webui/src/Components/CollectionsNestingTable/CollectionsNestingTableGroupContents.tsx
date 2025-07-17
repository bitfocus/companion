import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { CollectionsNestingTableDropZone } from './CollectionsNestingTableDropZone.js'
import { CollectionsNestingTableItemRow } from './CollectionsNestingTableRowWrappers.js'
import { CollectionsNestingTableNestingRow } from './CollectionsNestingTableNestingRow.js'
import { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionsListItemDrop } from './useItemDrop.js'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'

interface CollectionsNestingTableCollectionContentsProps<TItem extends CollectionsNestingTableItem> {
	items: TItem[]
	collectionId: string | null
	showNoItemsMessage: boolean
	nestingLevel: number
}

export const CollectionsNestingTableCollectionContents = observer(function CollectionsNestingTableCollectionContents<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>({ items, collectionId, showNoItemsMessage, nestingLevel }: CollectionsNestingTableCollectionContentsProps<TItem>) {
	const { dragId, collectionsApi, itemName, ItemRow } = useCollectionsNestingTableContext<TCollection, TItem>()

	const { isDragging, drop } = useCollectionsListItemDrop(collectionsApi, dragId, collectionId, null, 0)

	let visibleCount = 0

	const itemRows = items
		.map((item, index) => {
			const childNode = ItemRow(item, index)

			// Apply visibility filters
			if (!childNode) {
				return null
			}

			visibleCount++

			return (
				<CollectionsNestingTableItemRow<TCollection, TItem>
					key={item.id}
					item={item}
					index={index}
					nestingLevel={nestingLevel}
				>
					{childNode}
				</CollectionsNestingTableItemRow>
			)
		})
		.filter((row) => row !== null)

	// Calculate number of hidden items
	const hiddenCount = items.length - visibleCount

	return (
		<>
			{itemRows}

			{isDragging && items.length === 0 && (
				<CollectionsNestingTableDropZone drop={drop} itemName={itemName} nestingLevel={nestingLevel} />
			)}

			{hiddenCount > 0 && (
				<div className="collections-nesting-table-row-item">
					<CollectionsNestingTableNestingRow className="flex flex-row align-items-center" nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>
							{hiddenCount} {itemName}s are hidden
						</strong>
					</CollectionsNestingTableNestingRow>
				</div>
			)}

			{showNoItemsMessage && items.length === 0 && !isDragging && (
				<div className="collections-nesting-table-row-item">
					<CollectionsNestingTableNestingRow className="flex flex-row align-items-center" nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>This collection is empty</strong>
					</CollectionsNestingTableNestingRow>
				</div>
			)}
		</>
	)
})
