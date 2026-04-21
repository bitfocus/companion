import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { capitalize } from 'lodash-es'
import { observer } from 'mobx-react-lite'
import { usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import {
	CollectionsNestingTableContextProvider,
	type CollectionsNestingTableContextType,
} from './CollectionsNestingTableContext.js'
import { CollectionsNestingTableCollectionContents } from './CollectionsNestingTableGroupContents.js'
import {
	CollectionItemsCollapseButtons,
	CollectionsNestingTableCollectionsList,
} from './CollectionsNestingTableGroupsList.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionsListItemDrop } from './useItemDrop.js'

interface CollectionsNestingTableProps<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
> extends CollectionsNestingTableContextType<TCollection, TItem> {
	Heading?: React.ComponentType
	NoContent: React.ComponentType

	collections: TCollection[]
	items: TItem[]
}

export const CollectionsNestingTable = observer(function CollectionsNestingTable<
	TCollection extends CollectionsNestingTableCollection,
	TItem extends CollectionsNestingTableItem,
>({
	Heading,
	NoContent,
	ItemRow,
	GroupHeaderContent,
	showCollapseButtons,
	itemName,
	dragId,
	collectionsApi,
	selectedItemId,
	gridLayout,

	collections,
	items,
}: CollectionsNestingTableProps<TCollection, TItem>) {
	const { groupedItems, ungroupedItems } = getGroupedItems(items, collections)

	const { isDragging } = useCollectionsListItemDrop(collectionsApi, dragId, null, null, 0, gridLayout ?? false) // Assuming null for root level collections

	return (
		<CollectionsNestingTableContextProvider
			ItemRow={ItemRow}
			GroupHeaderContent={GroupHeaderContent}
			showCollapseButtons={showCollapseButtons}
			itemName={itemName}
			collectionsApi={collectionsApi}
			dragId={dragId}
			selectedItemId={selectedItemId}
			gridLayout={gridLayout}
		>
			<div className="collections-nesting-table">
				{!!Heading && (
					<div className="collections-nesting-table-header">
						<Heading />
					</div>
				)}

				<CollectionsNestingTableCollectionsList
					collections={collections}
					parentId={null}
					groupedItems={groupedItems}
					nestingLevel={0}
				/>

				<UngroupedSection
					isDragging={isDragging}
					ungroupedItems={ungroupedItems}
					hasCollections={collections.length > 0}
					itemName={itemName}
					showCollapseButtons={showCollapseButtons}
				/>

				{items.length === 0 && (
					<div>
						<NoContent />
					</div>
				)}
			</div>
		</CollectionsNestingTableContextProvider>
	)
})

// eslint-disable-next-line react-refresh/only-export-components
export const UNGROUPED_PANEL_ID = '__ungrouped__'

const UngroupedSection = observer(function UngroupedSection<TItem extends CollectionsNestingTableItem>({
	isDragging,
	ungroupedItems,
	hasCollections,
	itemName,
	showCollapseButtons,
}: {
	isDragging: boolean
	ungroupedItems: TItem[]
	hasCollections: boolean
	itemName: string
	showCollapseButtons?: boolean
}) {
	const collapseHelper = usePanelCollapseHelperContextForPanel(null, UNGROUPED_PANEL_ID)
	const isCollapsed = collapseHelper.isCollapsed

	const showHeader = (isDragging || ungroupedItems.length > 0) && hasCollections
	const isContentVisible = !showCollapseButtons || !isCollapsed || !showHeader

	return (
		<>
			{showHeader &&
				(showCollapseButtons ? (
					<div className="collections-nesting-table-row-group">
						<div className="d-flex align-items-center justify-content-between" onClick={collapseHelper.toggleCollapsed}>
							<div className="d-flex align-items-center">
								<FontAwesomeIcon icon={isCollapsed ? faCaretRight : faCaretDown} className="caret-icon me-1" />
								<span className="collection-name">Ungrouped {capitalize(itemName)}s</span>
							</div>
							{!isCollapsed && ungroupedItems.length > 1 && (
								<div className="d-flex align-items-center" onClick={(e) => e.stopPropagation()}>
									<CollectionItemsCollapseButtons itemIds={ungroupedItems.map((item) => item.id)} />
								</div>
							)}
						</div>
					</div>
				) : (
					<div className="collections-nesting-table-ungrouped-header">
						<span className="collection-name">Ungrouped {capitalize(itemName)}s</span>
					</div>
				))}

			{isContentVisible && (
				<CollectionsNestingTableCollectionContents
					items={ungroupedItems}
					collectionId={null}
					showNoItemsMessage={false}
					nestingLevel={0}
				/>
			)}
		</>
	)
})

function getGroupedItems<TItem extends CollectionsNestingTableItem>(
	allItems: TItem[],
	validCollections: CollectionsNestingTableCollection[]
) {
	const validCollectionIds = new Set<string>()
	const addCollectionIds = (collections: CollectionsNestingTableCollection[]) => {
		for (const collection of collections) {
			validCollectionIds.add(collection.id)
			if (collection.children) {
				addCollectionIds(collection.children)
			}
		}
	}
	addCollectionIds(validCollections)

	const groupedItems = new Map<string, TItem[]>()
	const ungroupedItems: TItem[] = []

	// Initialize empty arrays for all groups
	for (const collectionId of validCollectionIds) {
		groupedItems.set(collectionId, [])
	}

	// Assign connections to their groups
	for (const item of allItems) {
		if (item.collectionId && validCollectionIds.has(item.collectionId)) {
			groupedItems.get(item.collectionId)!.push(item)
		} else {
			ungroupedItems.push(item)
		}
	}

	// Sort connections by sortOrder within each collection
	ungroupedItems.sort((a, b) => a.sortOrder - b.sortOrder)
	for (const items of groupedItems.values()) {
		items.sort((a, b) => a.sortOrder - b.sortOrder)
	}

	return {
		groupedItems,
		ungroupedItems,
	}
}
