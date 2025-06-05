import React from 'react'
import { capitalize } from 'lodash-es'
import { GroupingTableGroupsList } from './GroupingTableGroupsList.js'
import type { GroupingTableGroup, GroupingTableItem } from './Types.js'
import { useGroupListItemDrop } from './useItemDrop.js'
import { GroupingTableContextProvider, GroupingTableContextType } from './GroupingTableContext.js'
import { GroupingTableGroupContents } from './GroupingTableGroupContents.js'
import { observer } from 'mobx-react-lite'

interface GroupingTableProps<TGroup extends GroupingTableGroup, TItem extends GroupingTableItem>
	extends GroupingTableContextType<TItem> {
	Heading: React.ComponentType
	NoContent: React.ComponentType

	groups: TGroup[]
	items: TItem[]
}

export const GroupingTable = observer(function GroupingTable<
	TGroup extends GroupingTableGroup,
	TItem extends GroupingTableItem,
>({
	Heading,
	NoContent,
	ItemRow,
	itemName,
	dragId,
	groupApi,
	selectedItemId,

	groups,
	items,
}: GroupingTableProps<TGroup, TItem>) {
	const { groupedItems, ungroupedItems } = getGroupedItems(items, new Set(groups.map((g) => g.id)))

	const { isDragging } = useGroupListItemDrop(groupApi, dragId, null, null, 0) // Assuming null for root level groups

	return (
		<GroupingTableContextProvider
			ItemRow={ItemRow}
			itemName={itemName}
			groupApi={groupApi}
			dragId={dragId}
			selectedItemId={selectedItemId}
		>
			<div className="grouping-table">
				<div className="grouping-table-header">
					<Heading />
				</div>

				<GroupingTableGroupsList groups={groups} parentId={null} groupedItems={groupedItems} nestingLevel={0} />

				{(isDragging || ungroupedItems.length > 0) && groups.length > 0 && (
					<div className="grouping-table-ungrouped-header">
						<span className="group-name">Ungrouped {capitalize(itemName)}s</span>
					</div>
				)}

				<GroupingTableGroupContents items={ungroupedItems} groupId={null} showNoItemsMessage={false} nestingLevel={0} />

				{items.length === 0 && (
					<div>
						<NoContent />
					</div>
				)}
			</div>
		</GroupingTableContextProvider>
	)
})

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
