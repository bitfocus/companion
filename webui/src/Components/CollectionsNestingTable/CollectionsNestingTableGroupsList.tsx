import { useDragOperation } from '@dnd-kit/react'
import { faCompressArrowsAlt, faExpandArrowsAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useDeferredValue } from 'react'
import { Button } from '~/Components/Button.js'
import { usePanelCollapseHelperContext, usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'
import { collectionDragType, collectionNestDropId, type CntCollectionDragData } from './CollectionsNestingTableDnd.js'
import { CollectionsNestingTableDropZone } from './CollectionsNestingTableDropZone.js'
import { CollectionsNestingTableCollectionContents } from './CollectionsNestingTableGroupContents.js'
import { CollectionsNestingTableCollectionRow } from './CollectionsNestingTableGroupRow.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'

interface CollectionsNestingTableCollectionsListProps<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
> {
	collections: TCollection[]
	parentId: string | null
	groupedItems: Map<string, TItem[]>
	nestingLevel: number
}

export const CollectionsNestingTableCollectionsList = observer(function CollectionsNestingTableCollectionsList<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>({
	collections,
	parentId,
	groupedItems,
	nestingLevel,
}: CollectionsNestingTableCollectionsListProps<TCollection, TItem>) {
	return (
		<>
			{collections.map((childCollection, index) => (
				<CollectionsNestingTableCollectionSingle
					key={childCollection.id}
					collection={childCollection}
					parentId={parentId}
					index={index}
					groupedItems={groupedItems}
					nestingLevel={nestingLevel}
				/>
			))}
		</>
	)
})

interface CollectionsNestingTableCollectionSingleProps<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
> {
	collection: TCollection
	parentId: string | null
	index: number
	groupedItems: Map<string, TItem[]>
	nestingLevel: number
}

// Note: mobx seems to get upset when a component is called recursively, without an intermediate component
const CollectionsNestingTableCollectionSingle = observer(function CollectionsNestingTableCollectionSingle<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>({
	collection,
	parentId,
	index,
	groupedItems,
	nestingLevel,
}: CollectionsNestingTableCollectionSingleProps<TCollection, TItem>) {
	const { dragId, collectionsApi, GroupHeaderContent, showCollapseButtons } = useCollectionsNestingTableContext<
		TCollection,
		TItem
	>()

	// Track whether a collection is being dragged, so we can collapse the dragged one and offer a nest
	// dropzone on empty collections (which have no child rows to sort into).
	//
	// Deferred by a frame: collections reorder via dnd-kit's native lift, which captures the dragged
	// element's position when the drag starts. Collapsing the dragged collection and showing the nest
	// drop zones both shift the layout, so doing it synchronously would move the dragged element before
	// the position is captured and leave the drag preview offset below the cursor. Deferring lets the
	// capture happen first (same fix as the empty-collection item drop zones in
	// CollectionsNestingTableCollectionContents).
	const { source } = useDragOperation()
	const rawDraggingCollectionId =
		!!collectionsApi && source?.type === collectionDragType(dragId)
			? (source.data as CntCollectionDragData).collectionId
			: undefined
	const draggingCollectionId = useDeferredValue(rawDraggingCollectionId)
	const isCollectionDragging = draggingCollectionId !== undefined

	const collapseHelper = usePanelCollapseHelperContextForPanel(null, collection.id)

	const isCollapsed = collapseHelper.isCollapsed || draggingCollectionId === collection.id
	const itemsInCollection = groupedItems.get(collection.id) || []

	const showNestDropZone =
		isCollectionDragging && draggingCollectionId !== collection.id && collection.children.length === 0

	return (
		<>
			<CollectionsNestingTableCollectionRow
				collectionsApi={collectionsApi}
				collection={collection}
				parentId={parentId}
				index={index}
				toggleExpanded={collapseHelper.toggleCollapsed}
				isCollapsed={isCollapsed}
				nestingLevel={nestingLevel}
			>
				{showCollapseButtons && !isCollapsed && itemsInCollection.length > 1 && (
					<CollectionItemsCollapseButtons itemIds={itemsInCollection.map((item) => item.id)} />
				)}
				{!!GroupHeaderContent && <GroupHeaderContent collection={collection} />}
			</CollectionsNestingTableCollectionRow>

			{!isCollapsed && (
				<>
					<CollectionsNestingTableCollectionsList
						collections={collection.children}
						parentId={collection.id}
						groupedItems={groupedItems}
						nestingLevel={nestingLevel + 1}
					/>

					{showNestDropZone ? (
						<CollectionsNestingTableDropZone
							droppableId={collectionNestDropId(collection.id)}
							accept={collectionDragType(dragId)}
							itemName="collection"
							nestingLevel={nestingLevel + 1}
						/>
					) : null}

					{/* Render connections in this group */}
					<CollectionsNestingTableCollectionContents
						items={itemsInCollection}
						collectionId={collection.id}
						showNoItemsMessage={collection.children.length === 0}
						nestingLevel={nestingLevel + 1}
					/>
				</>
			)}
		</>
	)
})

export const CollectionItemsCollapseButtons = observer(function CollectionItemsCollapseButtons({
	itemIds,
}: {
	itemIds: string[]
}) {
	const panelCollapseHelper = usePanelCollapseHelperContext()

	const hasCollapsed = itemIds.some((id) => panelCollapseHelper.isPanelCollapsed(null, id))
	const hasExpanded = itemIds.some((id) => !panelCollapseHelper.isPanelCollapsed(null, id))

	const collapseAll = useCallback(() => {
		panelCollapseHelper.setMultipleCollapsed(itemIds, true)
	}, [panelCollapseHelper, itemIds])

	const expandAll = useCallback(() => {
		panelCollapseHelper.setMultipleCollapsed(itemIds, false)
	}, [panelCollapseHelper, itemIds])

	return (
		<>
			{hasCollapsed && (
				<Button size="sm" color="link" onClick={expandAll} title="Expand all items">
					<FontAwesomeIcon icon={faExpandArrowsAlt} />
				</Button>
			)}
			{hasExpanded && (
				<Button size="sm" color="link" onClick={collapseAll} title="Collapse all items">
					<FontAwesomeIcon icon={faCompressArrowsAlt} />
				</Button>
			)}
		</>
	)
})
