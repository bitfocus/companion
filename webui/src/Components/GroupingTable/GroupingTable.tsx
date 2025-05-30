import React from 'react'
import { capitalize } from 'lodash-es'
import { GroupingTableGroupArray } from './GroupingTableStuff.js'
import type { GroupingTableGroup, GroupingTableItem } from './Types.js'
import { useGroupListItemDragging } from './useItemDragging.js'
import { GroupingTableContextProvider, GroupingTableContextType } from './GroupingTableContext.js'
import { CollapsibleGroupContents } from './CollapsibleGroupContents.js'

interface GroupingTableProps<TGroup extends GroupingTableGroup, TItem extends GroupingTableItem>
	extends GroupingTableContextType<TItem> {
	Heading: React.ComponentType
	NoContent: React.ComponentType

	groups: TGroup[]
	items: TItem[]
}

export function GroupingTable<TGroup extends GroupingTableGroup, TItem extends GroupingTableItem>({
	Heading,
	NoContent,
	ItemRow,
	itemName,
	dragId,
	groupApi,

	groups,
	items,
}: GroupingTableProps<TGroup, TItem>) {
	const { groupedItems, ungroupedItems } = getGroupedItems(items, new Set(groups.map((g) => g.id)))

	const { isDragging } = useGroupListItemDragging(groupApi, dragId, null) // Assuming null for root level groups

	return (
		<GroupingTableContextProvider ItemRow={ItemRow} itemName={itemName} groupApi={groupApi} dragId={dragId}>
			<div className="collapsible-group-table">
				<div className="collapsible-group-table-header">
					<Heading />
				</div>

				<GroupingTableGroupArray groups={groups} groupedItems={groupedItems} nestingLevel={0} />

				{(isDragging || ungroupedItems.length > 0) && groups.length > 0 && (
					<div className="grouping-table-ungrouped-header">
						<span className="group-name">Ungrouped {capitalize(itemName)}s</span>
					</div>
				)}

				<CollapsibleGroupContents items={ungroupedItems} groupId={null} showNoItemsMessage={false} nestingLevel={0} />

				{items.length === 0 && (
					<div>
						<NoContent />
					</div>
				)}
			</div>
		</GroupingTableContextProvider>
	)
}

function getGroupedItems<TItem extends GroupingTableItem>(allItems: TItem[], validGroupIds: Set<string>) {
	const groupedItems = new Map<string, TItem[]>()
	const ungroupedItems: TItem[] = []

	// Initialize empty arrays for all groups
	for (const groupId of validGroupIds) {
		groupedItems.set(groupId, [])
	}

	// Assign connections to their groups
	for (const item of allItems) {
		if (item.groupId && validGroupIds.has(item.groupId)) {
			groupedItems.get(item.groupId)!.push(item)
		} else {
			ungroupedItems.push(item)
		}
	}

	// Sort connections by sortOrder within each group
	ungroupedItems.sort((a, b) => a.sortOrder - b.sortOrder)
	for (const items of groupedItems.values()) {
		items.sort((a, b) => a.sortOrder - b.sortOrder)
	}

	return {
		groupedItems,
		ungroupedItems,
	}
}
