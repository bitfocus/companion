import { pointerIntersection } from '@dnd-kit/collision'
import { useDragOperation } from '@dnd-kit/react'
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useDeferredValue } from 'react'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'
import { emptyCollectionItemDropId } from './CollectionsNestingTableDnd.js'
import { CollectionsNestingTableDropZone } from './CollectionsNestingTableDropZone.js'
import { CollectionsNestingTableNestingRow } from './CollectionsNestingTableNestingRow.js'
import { CollectionsNestingTableItemRow } from './CollectionsNestingTableRowWrappers.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'

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

	// Defer showing the empty-list drop zones by a frame: dnd-kit captures the dragged element's position
	// when the drag starts, so if the drop zones appeared synchronously they'd shift the layout first and
	// the drag preview would end up offset below the cursor. Deferring lets the capture happen first.
	const { source } = useDragOperation()
	const isItemDragging = useDeferredValue(!!collectionsApi && source?.type === dragId)

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
				{itemRows.length > 0 && (
					<div
						className={classNames('collections-nesting-table-grid-container', {
							'collections-nesting-table-grid-nested': nestingLevel > 0,
						})}
						style={{
							// @ts-expect-error CSS custom properties are not typed
							'--collection-nesting-level': nestingLevel,
						}}
					>
						{itemRows}
					</div>
				)}

				{isItemDragging && items.length === 0 && (
					<CollectionsNestingTableDropZone
						droppableId={emptyCollectionItemDropId(collectionId)}
						accept={dragId}
						itemName={itemName}
						nestingLevel={nestingLevel}
						collisionDetector={pointerIntersection}
					/>
				)}

				{hiddenCount > 0 && (
					<div className="collections-nesting-table-grid-message">
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>
							{hiddenCount} {itemName}s are hidden
						</strong>
					</div>
				)}

				{showNoItemsMessage && items.length === 0 && !isItemDragging && (
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

			{isItemDragging && items.length === 0 && (
				<CollectionsNestingTableDropZone
					droppableId={emptyCollectionItemDropId(collectionId)}
					accept={dragId}
					itemName={itemName}
					nestingLevel={nestingLevel}
				/>
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

			{showNoItemsMessage && items.length === 0 && !isItemDragging && (
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
