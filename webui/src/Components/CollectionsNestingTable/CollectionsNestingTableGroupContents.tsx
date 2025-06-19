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
import { ConnectDropTarget } from 'react-dnd'
import useElementclientSize from '~/Hooks/useElementInnerSize.js'

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
	const { dragId, collectionsApi, itemName, ItemRow, gridLayout } = useCollectionsNestingTableContext<
		TCollection,
		TItem
	>()

	const { isDragging, drop } = useCollectionsListItemDrop(
		collectionsApi,
		dragId,
		collectionId,
		null,
		items.length,
		gridLayout ?? false
	)

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

	if (gridLayout) {
		return (
			<>
				{itemRows.length > 0 && <CollectionsNestingTableCollectionGridContents itemRows={itemRows} drop={drop} />}

				{isDragging && items.length === 0 && (
					<CollectionsNestingTableDropZone drop={drop} itemName={itemName} nestingLevel={nestingLevel} />
				)}

				{hiddenCount > 0 && (
					<div className="collections-nesting-table-grid-message">
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>
							{hiddenCount} {itemName}s are hidden
						</strong>
					</div>
				)}

				{showNoItemsMessage && items.length === 0 && !isDragging && (
					<div className="collections-nesting-table-grid-message">
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>This collection is empty</strong>
					</div>
				)}
			</>
		)
	}

	return (
		<>
			{itemRows}

			{isDragging && items.length === 0 && (
				<CollectionsNestingTableDropZone drop={drop} itemName={itemName} nestingLevel={nestingLevel} />
			)}

			{hiddenCount > 0 && (
				<div className="collections-nesting-table-row-item">
					<CollectionsNestingTableNestingRow nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>
							{hiddenCount} {itemName}s are hidden
						</strong>
					</CollectionsNestingTableNestingRow>
				</div>
			)}

			{showNoItemsMessage && items.length === 0 && !isDragging && (
				<div className="collections-nesting-table-row-item">
					<CollectionsNestingTableNestingRow nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>This collection is empty</strong>
					</CollectionsNestingTableNestingRow>
				</div>
			)}
		</>
	)
})

function CollectionsNestingTableCollectionGridContents({
	itemRows,
	drop,
}: {
	itemRows: React.ReactNode[]
	drop: ConnectDropTarget
}) {
	const [elmRef, elmSize, elm] = useElementclientSize()

	// Calculate visible columns accounting for padding and gaps
	let displayColumns = 0
	if (elmSize && elm) {
		const elmComputedStyle = window.getComputedStyle(elm)

		// assume px
		const tileTargetMinWidth = parseFloat(
			elmComputedStyle.getPropertyValue('--collection-nesting-table-grid-tile-min-width')
		)

		const containerPadding = parseFloat(elmComputedStyle.paddingLeft) * 2
		const gap = parseFloat(elmComputedStyle.gap)
		const availableWidth = elmSize.width - containerPadding

		displayColumns = Math.floor((availableWidth + gap) / (tileTargetMinWidth + gap))
	}

	const spacerSpan = displayColumns > 0 ? displayColumns - (itemRows.length % displayColumns) : 0

	return (
		<div className="collections-nesting-table-grid-container" ref={elmRef}>
			{itemRows}

			<div
				className="collections-nesting-table-grid-end-spacer"
				ref={drop}
				style={{
					// @ts-expect-error TypeScript doesn't recognize CSS custom properties
					'--collection-nesting-table-grid-end-spacer-span': spacerSpan,
				}}
			/>
		</div>
	)
}
