import React from 'react'
import { observer } from 'mobx-react-lite'
import { usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import { CollectionsNestingTableDropZone } from './CollectionsNestingTableDropZone.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionListCollectionDrop } from './useCollectionDrop.js'
import { CollectionsNestingTableCollectionRow } from './CollectionsNestingTableGroupRow.js'
import { useCollectionsNestingTableContext } from './CollectionsNestingTableContext.js'
import { CollectionsNestingTableCollectionContents } from './CollectionsNestingTableGroupContents.js'

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
	const { dragId, collectionsApi, GroupHeaderContent } = useCollectionsNestingTableContext<TCollection, TItem>()

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
