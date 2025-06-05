import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useRef } from 'react'
import { useDrag, ConnectDragSource, ConnectDropTarget, ConnectDragPreview } from 'react-dnd'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'
import { CollectionsNestingTableNestingRow } from './CollectionsNestingTableNestingRow.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionsListItemDrop, CollectionsNestingTableItemDragItem } from './useItemDrop.js'
import { CollectionsNestingTableCollectionDragItem } from './useCollectionDrop.js'
import { observer } from 'mobx-react-lite'

export const CollectionsNestingTableItemRow = observer(function CollectionsNestingTableItemRow<
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
	const { dragId, collectionsApi, selectedItemId } = useCollectionsNestingTableContext<TItem>()

	const { drop } = useCollectionsListItemDrop(collectionsApi, dragId, item.groupId, item.id, index)
	const [{ isDragging }, drag, preview] = useDrag<
		CollectionsNestingTableItemDragItem,
		unknown,
		{ isDragging: boolean }
	>({
		type: dragId,
		item: {
			itemId: item.id,
			collectionId: item.groupId,
			index,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

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

export const CollectionsNestingTableCollectionRowWrapper = observer(
	function CollectionsNestingTableCollectionRowWrapper<TCollection extends CollectionsNestingTableCollection>({
		collection,
		parentId,
		nestingLevel,
		children,
	}: React.PropsWithChildren<{
		collection: TCollection
		parentId: string | null
		nestingLevel: number
	}>) {
		const { dragId, collectionsApi } = useCollectionsNestingTableContext<CollectionsNestingTableItem>()

		// Allow dropping items onto the collection, to add them to the collection
		const { drop } = useCollectionsListItemDrop(collectionsApi, dragId, collection.id, null, -1)

		const [{ isDragging }, drag, preview] = useDrag<
			CollectionsNestingTableCollectionDragItem,
			unknown,
			{ isDragging: boolean }
		>({
			type: `${dragId}-collection`,
			item: {
				collectionId: collection.id,
				parentId: parentId,
				dragState: null,
			},
			collect: (monitor) => ({
				isDragging: monitor.isDragging(),
			}),
		})

		return (
			<CollectionsNestingTableRowBase
				drag={drag}
				drop={drop}
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
			<CollectionsNestingTableNestingRow nestingLevel={nestingLevel}>
				<div ref={drag} className="row-reorder-handle">
					<FontAwesomeIcon icon={faSort} />
				</div>
				<div className="grow">{children}</div>
			</CollectionsNestingTableNestingRow>
		</div>
	)
}
