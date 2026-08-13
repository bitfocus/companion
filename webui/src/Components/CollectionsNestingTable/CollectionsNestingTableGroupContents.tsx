import { pointerIntersection } from '@dnd-kit/collision'
import { useDragOperation, useDroppable } from '@dnd-kit/react'
import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useDeferredValue, useLayoutEffect, useRef, useState, type PropsWithChildren } from 'react'
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
					<CollectionsNestingTableGridContainer
						collectionId={collectionId}
						accept={dragId}
						nestingLevel={nestingLevel}
						isItemDragging={isItemDragging}
						itemCount={itemRows.length}
					>
						{itemRows}
					</CollectionsNestingTableGridContainer>
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
					<CollectionsNestingTableNestingRow className="flex flex-row items-center" nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>
							{hiddenCount} {itemName}s are hidden
						</strong>
					</CollectionsNestingTableNestingRow>
				</div>
			)}

			{showNoItemsMessage && items.length === 0 && !isItemDragging && (
				<div className="collections-nesting-table-row-item">
					<CollectionsNestingTableNestingRow className="flex flex-row items-center" nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>This collection is empty</strong>
					</CollectionsNestingTableNestingRow>
				</div>
			)}
		</>
	)
})

function CollectionsNestingTableGridContainer({
	collectionId,
	accept,
	nestingLevel,
	isItemDragging,
	itemCount,
	children,
}: PropsWithChildren<{
	collectionId: string | null
	accept: string
	nestingLevel: number
	isItemDragging: boolean
	itemCount: number
}>): React.JSX.Element {
	const containerRef = useRef<HTMLDivElement | null>(null)
	const [columnCount, setColumnCount] = useState<number | null>(null)

	// Measure the grid's resolved column count when a drag starts (width doesn't change mid-drag). The
	// trailing empty-cell count is then derived from the live item count on each render.
	useLayoutEffect(() => {
		if (!isItemDragging || !containerRef.current) {
			setColumnCount(null)
			return
		}
		const cols = getComputedStyle(containerRef.current).gridTemplateColumns.split(' ').filter(Boolean).length
		setColumnCount(cols > 0 ? cols : null)
	}, [isItemDragging])

	// Empty cells left in the last row (0 when the last row is exactly full, so nothing is rendered)
	const trailingEmptyCells = columnCount ? (columnCount - (itemCount % columnCount)) % columnCount : 0

	return (
		<div
			ref={containerRef}
			className={classNames('collections-nesting-table-grid-container', {
				'collections-nesting-table-grid-nested': nestingLevel > 0,
			})}
			style={{
				// @ts-expect-error CSS custom properties are not typed
				'--collection-nesting-level': nestingLevel,
			}}
		>
			{children}

			{isItemDragging && trailingEmptyCells > 0 && (
				<CollectionsNestingTableGridEndDropZone collectionId={collectionId} accept={accept} span={trailingEmptyCells} />
			)}
		</div>
	)
}

/**
 * An invisible drop target that fills exactly the empty "void" cells after the last tile in a grid, so a
 * tile can be appended by hovering that space instead of having to land on the last tile. It occupies only
 * already-empty cells (no layout shift, and none rendered when the last row is full), and reuses the
 * empty-collection drop id which the reorder monitor resolves to this collection with an end index (-1).
 */
function CollectionsNestingTableGridEndDropZone({
	collectionId,
	accept,
	span,
}: {
	collectionId: string | null
	accept: string
	span: number
}): React.JSX.Element {
	const { ref } = useDroppable({
		id: emptyCollectionItemDropId(collectionId),
		accept,
		collisionDetector: pointerIntersection,
	})

	return (
		<div ref={ref} className="collections-nesting-table-grid-end-dropzone" style={{ gridColumn: `span ${span}` }} />
	)
}
