import { useDragOperation } from '@dnd-kit/react'
import './CollectionsNestingTable.css'
import { faCaretDown, faCaretRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useLayoutEffect, useRef } from 'react'
import { capitalize } from '@companion-app/shared/Util.js'
import { usePanelCollapseHelperContextForPanel } from '~/Helpers/CollapseHelper.js'
import {
	CollectionsNestingTableContextProvider,
	type CollectionsNestingTableContextType,
} from './CollectionsNestingTableContext.js'
import { CollectionsNestingTableDragLayer } from './CollectionsNestingTableDragLayer.js'
import { CollectionsNestingTableCollectionContents } from './CollectionsNestingTableGroupContents.js'
import {
	CollectionItemsCollapseButtons,
	CollectionsNestingTableCollectionsList,
} from './CollectionsNestingTableGroupsList.js'
import type { CollectionsNestingTableCollection, CollectionsNestingTableItem } from './Types.js'
import { useCollectionsNestingTableReorderMonitor } from './useCollectionsNestingTableReorderMonitor.js'

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

	// Persist drag operations (both items and collections) on drop
	useCollectionsNestingTableReorderMonitor(dragId, collectionsApi)

	// Whether an item drag is in progress, so the Ungrouped section reveals itself as a drop target
	const { source } = useDragOperation()
	const isDragging = !!collectionsApi && source?.type === dragId

	// Every collection's grid runs its own auto-fill, so nested (indented, narrower) grids would break to a
	// different column count than the wider ungrouped grid within the same window. Derive one shared column
	// count from the full (un-indented) width and hand it to every grid via --cnt-grid-cols, so they all show
	// the same number of columns; nested grids just render marginally smaller tiles for their indent.
	const rootRef = useRef<HTMLDivElement>(null)
	useLayoutEffect(() => {
		const root = rootRef.current
		if (!root || !gridLayout) return

		const recompute = () => {
			const grid = root.querySelector<HTMLElement>('.collections-nesting-table-grid-container')
			if (!grid) return
			const style = getComputedStyle(grid)
			const minTile = parseFloat(style.getPropertyValue('--collection-nesting-table-grid-tile-min-width')) || 200
			const gap = parseFloat(style.columnGap) || 0
			const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
			// Reference width = a full-width (level 0) grid, so nested grids conform to the widest grid's count
			const available = root.clientWidth - padX
			const cols = Math.max(1, Math.floor((available + gap) / (minTile + gap)))
			root.style.setProperty('--cnt-grid-cols', String(cols))
			root.style.setProperty('--cnt-grid-track-min', '0')
		}

		recompute()
		const observer = new ResizeObserver(recompute)
		observer.observe(root)
		return () => observer.disconnect()
	}, [gridLayout])

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
			<div className="collections-nesting-table" ref={rootRef}>
				{/* Rendered here (inside the table) so the drag preview clone is styled by the real CSS */}
				<CollectionsNestingTableDragLayer />

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
						<div className="flex items-center justify-between" onClick={collapseHelper.toggleCollapsed}>
							<div className="flex items-center">
								<FontAwesomeIcon icon={isCollapsed ? faCaretRight : faCaretDown} className="caret-icon me-1" />
								<span className="collection-name">Ungrouped {capitalize(itemName)}s</span>
							</div>
							{!isCollapsed && ungroupedItems.length > 1 && (
								<div className="flex items-center" onClick={(e) => e.stopPropagation()}>
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
