import { faCompressArrowsAlt, faExpandArrowsAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { Button } from '~/Components/Button.js'
import { usePanelCollapseHelperContext, usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'
import { CollectionsNestingTableDropZone } from './CollectionsNestingTableDropZone.js'
import { CollectionsNestingTableCollectionContents } from './CollectionsNestingTableGroupContents.js'
import { CollectionsNestingTableCollectionRow } from './CollectionsNestingTableGroupRow.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionListCollectionDrop } from './useCollectionDrop.js'

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

	const { canDrop, dragCollectionId, drop } = useCollectionListCollectionDrop(
		collectionsApi,
		dragId,
		collection.id,
		-1,
		'contents'
	)

	const collapseHelper = usePanelCollapseHelperContextForPanel(null, collection.id)

	const isCollapsed = collapseHelper.isCollapsed || (!!dragCollectionId && dragCollectionId === collection.id)
	const itemsInCollection = groupedItems.get(collection.id) || []

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

					{canDrop && (!collection.children || collection.children.length === 0) ? (
						<CollectionsNestingTableDropZone drop={drop} itemName="collection" nestingLevel={nestingLevel + 1} />
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
