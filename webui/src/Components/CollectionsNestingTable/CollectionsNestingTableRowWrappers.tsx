import { pointerIntersection } from '@dnd-kit/collision'
import { useDroppable } from '@dnd-kit/react'
import { useSortable } from '@dnd-kit/react/sortable'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useMemo } from 'react'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'
import {
	collectionDragType,
	collectionGroupKey,
	collectionItemHeaderDropId,
	itemGroupKey,
	mergeDndRefs,
	type CntCollectionDragData,
	type CntItemDragData,
} from './CollectionsNestingTableDnd.js'
import { CollectionsNestingTableGridTile } from './CollectionsNestingTableGridTile.js'
import { CollectionsNestingTableNestingRow } from './CollectionsNestingTableNestingRow.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'

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
	const { dragId, collectionsApi, selectedItemId, gridLayout } = useCollectionsNestingTableContext<TCollection, TItem>()

	// Items reorder on hover via a DragOverlay (dnd-kit doesn't move/clone the source), so dim the source
	// row/tile ourselves to show which one is being dragged, and target exactly what's under the cursor.
	const { ref, handleRef, isDragging } = useSortable({
		id: item.id,
		index,
		type: dragId,
		accept: dragId,
		group: itemGroupKey(item.collectionId),
		data: { kind: 'cnt-item', itemId: item.id, gridLayout: !!gridLayout } satisfies CntItemDragData,
		disabled: !collectionsApi,
		collisionDetector: pointerIntersection,
	})

	if (gridLayout) {
		return (
			<CollectionsNestingTableGridTile
				rowRef={ref}
				dragRef={handleRef}
				isDragging={isDragging}
				isSelected={item.id === selectedItemId}
				allowDrag={!!collectionsApi}
				className="collections-nesting-table-tile-item"
			>
				{children}
			</CollectionsNestingTableGridTile>
		)
	}

	return (
		<CollectionsNestingTableRowBase
			rowRef={ref}
			dragRef={handleRef}
			isDragging={isDragging}
			isSelected={item.id === selectedItemId}
			nestingLevel={nestingLevel}
			className="collections-nesting-table-row-item"
			allowDrag={!!collectionsApi}
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
		const { dragId, collectionsApi } = useCollectionsNestingTableContext<TCollection, CollectionsNestingTableItem>()

		// The collection row is sortable amongst its sibling collections (and can nest into others)...
		const { ref: sortableRef, handleRef } = useSortable({
			id: collection.id,
			index,
			type: collectionDragType(dragId),
			accept: collectionDragType(dragId),
			group: collectionGroupKey(parentId),
			data: { kind: 'cnt-collection', collectionId: collection.id } satisfies CntCollectionDragData,
			disabled: !collectionsApi,
		})

		// ...and it's also a drop target for items, so an item can be dropped onto the header (handy when
		// the collection is collapsed and has no contents to sort into). Handled in the reorder monitor.
		const { ref: itemDropRef } = useDroppable({
			id: collectionItemHeaderDropId(collection.id),
			accept: dragId,
			disabled: !collectionsApi,
			// Match the items' pointer-based collision so a hovered item can target this header.
			collisionDetector: pointerIntersection,
		})

		const rowRef = useMemo(() => mergeDndRefs(sortableRef, itemDropRef), [sortableRef, itemDropRef])

		return (
			<CollectionsNestingTableRowBase
				rowRef={rowRef}
				dragRef={handleRef}
				isSelected={false}
				nestingLevel={nestingLevel}
				className="collections-nesting-table-row-group"
				allowDrag={!!collectionsApi}
			>
				{children}
			</CollectionsNestingTableRowBase>
		)
	}
)

function CollectionsNestingTableRowBase({
	className,
	rowRef,
	dragRef,
	isDragging,
	isSelected,
	nestingLevel,
	allowDrag,
	children,
}: React.PropsWithChildren<{
	className: string
	rowRef: (element: Element | null) => void
	dragRef: (element: Element | null) => void
	isDragging?: boolean
	isSelected: boolean
	allowDrag: boolean
	nestingLevel: number
}>) {
	const { gridLayout } = useCollectionsNestingTableContext()

	return (
		<div
			className={classNames(className, {
				'row-dragging': isDragging,
				'row-selected': isSelected,
			})}
			ref={rowRef}
		>
			<CollectionsNestingTableNestingRow
				className="collections-nesting-table-row-item-grid"
				nestingLevel={gridLayout ? 0 : nestingLevel}
			>
				{allowDrag ? (
					<div ref={dragRef} className="row-reorder-handle">
						<FontAwesomeIcon icon={faSort} />
					</div>
				) : (
					// Empty div to preserve columns
					<div></div>
				)}
				<div className="grow">{children}</div>
			</CollectionsNestingTableNestingRow>
		</div>
	)
}
