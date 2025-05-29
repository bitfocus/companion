import React from 'react'
import { CollabsibleGroupItems } from './CollapsibleGroupItems.js'
import { capitalize } from 'lodash-es'
import { CollapsibleGroupsArray } from './CollapsibleGroupStuff.js'
import type { CollapsibleGroup, CollapsibleGroupItem, GroupApi } from './Types.js'
import { useGroupListItemDragging } from './useItemDragging.js'

interface CollapsibleGroupTableProps<TGroup extends CollapsibleGroup, TItem extends CollapsibleGroupItem> {
	Heading: React.ComponentType
	NoContent: React.ComponentType
	ItemRow: React.ComponentType<{ item: TItem; index: number; nestingLevel: number }>
	itemName: string
	groupApi: GroupApi

	groups: TGroup[]
	items: TItem[]
}

export function CollapsibleGroupTable<TGroup extends CollapsibleGroup, TItem extends CollapsibleGroupItem>({
	Heading,
	NoContent,
	ItemRow,
	itemName,
	groupApi,

	groups,
	items,
}: CollapsibleGroupTableProps<TGroup, TItem>) {
	const { groupedItems, ungroupedItems } = getGroupedItems(items, new Set(groups.map((g) => g.id)))

	const { isDragging } = useGroupListItemDragging(groupApi, null) // Assuming null for root level groups

	return (
		<div className="collapsible-group-table">
			<div className="collapsible-group-table-header">
				<Heading />
			</div>

			<CollapsibleGroupsArray
				ItemRow={ItemRow}
				itemName={itemName}
				groupApi={groupApi}
				groups={groups}
				groupedItems={groupedItems}
				nestingLevel={0}
			/>

			{(isDragging || ungroupedItems.length > 0) && groups.length > 0 && (
				<div>
					<span className="group-name">Ungrouped {capitalize(itemName)}s</span>
				</div>
			)}

			<CollabsibleGroupItems
				ItemRow={ItemRow}
				itemName={itemName}
				groupApi={groupApi}
				items={ungroupedItems}
				groupId={null}
				showNoItemsMessage={false}
			/>

			{items.length === 0 && (
				<div>
					<NoContent />
				</div>
			)}
		</div>
	)
}

function getGroupedItems<TItem extends CollapsibleGroupItem>(allItems: TItem[], validGroupIds: Set<string>) {
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
