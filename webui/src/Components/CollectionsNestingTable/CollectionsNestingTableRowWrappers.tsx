import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useRef } from 'react'
import {
	useDrag,
	type ConnectDragSource,
	type ConnectDropTarget,
	type ConnectDragPreview,
	useDragLayer,
} from 'react-dnd'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'
import { CollectionsNestingTableNestingRow } from './CollectionsNestingTableNestingRow.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionsListItemDrop, type CollectionsNestingTableItemDragItem } from './useItemDrop.js'
import { useCollectionListCollectionDrop, type CollectionsNestingTableCollectionDragItem } from './useCollectionDrop.js'
import { observer } from 'mobx-react-lite'

/* 
	The INDIVIDUAL items in the table
 */
export const CollectionsNestingTableItemRow = observer(function CollectionsNestingTableItemRow<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>({
	item,
	index,
	nestingLevel,
	children,
}: React.PropsWithChildren<{
	item: TItem
	index: number
	nestingLevel: number
}>) {
	const { dragId, collectionsApi, selectedItemId } = useCollectionsNestingTableContext<TCollection, TItem>()

	const { drop } = useCollectionsListItemDrop(collectionsApi, dragId, item.collectionId, item.id, index)
	const [_c, drag, preview] = useDrag<CollectionsNestingTableItemDragItem, unknown, { isDragging: boolean }>({
		type: dragId,
		item: {
			itemId: item.id,
			collectionId: item.collectionId,
			index,
			dragState: null,
		},
	})

	// Check if the current item is being dragged
	const { draggingItem } = useDragLayer((monitor) => ({
		draggingItem: monitor.getItem<CollectionsNestingTableItemDragItem>(),
	}))
	const isDragging = draggingItem?.itemId === item.id

	return (
		<CollectionsNestingTableRowBase
			drag={drag}
			drop={drop}
			preview={preview}
			isDragging={isDragging}
			isSelected={item.id === selectedItemId}
			nestingLevel={nestingLevel}
			className="collections-nesting-table-row-item"
		>
			{children}
		</CollectionsNestingTableRowBase>
	)
})

/* 
	The COLLECTIONS items in the table
 */
export const CollectionsNestingTableCollectionRowWrapper = observer(
	function CollectionsNestingTableCollectionRowWrapper<TCollection extends CollectionsNestingTableCollection>({
		collection,
		parentId,
		index,
		nestingLevel,
		children,
	}: React.PropsWithChildren<{
		collection: TCollection
		parentId: string | null
		index: number
		nestingLevel: number
	}>) {
		const collData = useCollectionsNestingTableContext<TCollection, CollectionsNestingTableItem>()
		const { dragId, collectionsApi } = collData

		// Allow dropping items onto the collection, to add them to the collection
		const { drop } = useCollectionsListItemDrop(collectionsApi, dragId, collection.id, null, -1)
		const { drop: collectionDrop } = useCollectionListCollectionDrop(
			collectionsApi,
			dragId,
			parentId,
			index,
			collection.id
		)

		const [_c, drag, preview] = useDrag<CollectionsNestingTableCollectionDragItem, unknown, { isDragging: boolean }>({
			type: `${dragId}-collection`,
			item: {
				collectionId: collection.id,
				index,
				parentId: parentId,
				dragState: null,
			},
		})

		// Check if the current item is being dragged
		const { draggingItem } = useDragLayer((monitor) => ({
			draggingItem: monitor.getItem<CollectionsNestingTableCollectionDragItem>(),
		}))
		// dragging the collection itself and not an item inside the collection
		const isDragging = draggingItem?.collectionId === collection.id && !('itemId' in draggingItem)

		return (
			<CollectionsNestingTableRowBase
				drag={drag}
				drop={(e) => drop(collectionDrop(e))}
				preview={preview}
				isDragging={isDragging}
				isSelected={false}
				nestingLevel={nestingLevel}
				className="collections-nesting-table-row-group"
			>
				{children}
			</CollectionsNestingTableRowBase>
		)
	}
)

function CollectionsNestingTableRowBase({
	className,
	drag,
	drop,
	preview,
	isDragging,
	isSelected,
	nestingLevel,
	children,
}: React.PropsWithChildren<{
	className: string
	drag: ConnectDragSource
	drop: ConnectDropTarget
	preview: ConnectDragPreview
	isDragging: boolean
	isSelected: boolean
	nestingLevel: number
}>) {
	const ref = useRef<HTMLDivElement>(null)
	preview(drop(ref))

	return (
		<div
			className={classNames(className, {
				'row-dragging': isDragging,
				'row-notdragging': !isDragging,
				'row-selected': isSelected,
			})}
			ref={ref}
		>
			<CollectionsNestingTableNestingRow
				className="collections-nesting-table-row-item-grid"
				nestingLevel={nestingLevel}
			>
				<div ref={drag} className="row-reorder-handle">
					<FontAwesomeIcon icon={faSort} />
				</div>
				<div className="grow">{children}</div>
			</CollectionsNestingTableNestingRow>
		</div>
	)
}
