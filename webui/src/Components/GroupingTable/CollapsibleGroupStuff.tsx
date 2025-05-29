import React from 'react'
import { observer } from 'mobx-react-lite'
import { usePanelCollapseHelperContextForPanel } from '../../Helpers/CollapseHelper.js'
import { CollapsibleListDropZone } from '../../Components/GroupingTable/CollapsibleListDropZone.js'
import { CollabsibleGroupItems } from './CollapsibleGroupItems.js'
import type { CollapsibleGroup, CollapsibleGroupItem, GroupApi } from './Types.js'
import { useGroupListGroupDragging } from './useGroupDragging.js'
import { CollapsibleGroupRow } from './CollapsibleGroupRow.js'
import { ConnectDropTarget } from 'react-dnd'
import { useGroupListItemDragging } from './useItemDragging.js'

interface CollapsibleGroupsArrayProps<TGroup extends CollapsibleGroup, TItem extends CollapsibleGroupItem> {
	ItemRow: React.ComponentType<{ item: TItem; index: number; nestingLevel: number }>
	itemName: string
	groupApi: GroupApi

	groups: TGroup[]
	groupedItems: Map<string, TItem[]>
	nestingLevel: number
}

export const CollapsibleGroupsArray = observer(function CollapsibleGroupsArray<
	TGroup extends CollapsibleGroup,
	TItem extends CollapsibleGroupItem,
>({ ItemRow, itemName, groupApi, groups, groupedItems, nestingLevel }: CollapsibleGroupsArrayProps<TGroup, TItem>) {
	return (
		<>
			{groups.map((childGroup, childIndex) => (
				<CollapsibleGroupSingle
					key={childGroup.id}
					ItemRow={ItemRow}
					itemName={itemName}
					groupApi={groupApi}
					index={childIndex}
					group={childGroup}
					groupedItems={groupedItems}
					nestingLevel={nestingLevel}
				/>
			))}
		</>
	)
})

interface CollapsibleGroupSingleProps<TGroup extends CollapsibleGroup, TItem extends CollapsibleGroupItem> {
	ItemRow: React.ComponentType<{ item: TItem; index: number; nestingLevel: number }>
	itemName: string
	groupApi: GroupApi

	index: number
	group: TGroup
	groupedItems: Map<string, TItem[]>
	nestingLevel?: number
}

// Note: mobx seems to get upset when a component is called recursively, without an intermediate component
const CollapsibleGroupSingle = observer(function CollapsibleGroupSingle<
	TGroup extends CollapsibleGroup,
	TItem extends CollapsibleGroupItem,
>({
	ItemRow,
	itemName,
	groupApi,
	index,
	group,
	groupedItems,
	nestingLevel = 0,
}: CollapsibleGroupSingleProps<TGroup, TItem>) {
	const { isOver, canDrop, dragGroupId, drop } = useGroupListGroupDragging(groupApi, group.id)

	const collapseHelper = usePanelCollapseHelperContextForPanel(null, group.id)

	const isCollapsed = collapseHelper.isCollapsed || (!!dragGroupId && dragGroupId === group.id)
	const itemsInGroup = groupedItems.get(group.id) || []

	return (
		<>
			<CollapsibleGroupRow2
				groupApi={groupApi}
				group={group}
				toggleExpanded={collapseHelper.toggleCollapsed}
				isCollapsed={isCollapsed}
				index={index}
				nestingLevel={nestingLevel}
			/>

			{!isCollapsed && (
				<>
					<CollapsibleGroupsArray
						ItemRow={ItemRow}
						itemName={itemName}
						groupApi={groupApi}
						groups={group.children}
						groupedItems={groupedItems}
						nestingLevel={nestingLevel + 1}
					/>

					{canDrop && (!group.children || group.children.length === 0) ? (
						<CollapsibleListDropZone drop={drop} itemName="group" />
					) : null}

					{/* Render connections in this group */}
					<CollabsibleGroupItems
						ItemRow={ItemRow}
						itemName={itemName}
						groupApi={groupApi}
						items={itemsInGroup}
						groupId={group.id}
						showNoItemsMessage={group.children.length === 0}
						nestingLevel={nestingLevel}
					/>
				</>
			)}
		</>
	)
})

interface CollapsibleGroupRow2Props {
	group: CollapsibleGroup
	toggleExpanded: () => void
	groupApi: GroupApi
	isCollapsed: boolean
	index: number
	nestingLevel: number
}
const CollapsibleGroupRow2 = observer(function CollapsibleGroupRow2({
	group,
	toggleExpanded,
	groupApi,
	isCollapsed,
	index,
	nestingLevel,
}: CollapsibleGroupRow2Props) {
	const { drop: dropConnectionInto } = useGroupListItemDragging(groupApi, group.id, -1)
	const { isOver, canDrop, drop: dropGroupInto } = useGroupListGroupDragging(groupApi, group.id)

	// Function that combines both drop targets
	let combinedDropInto: ConnectDropTarget = dropConnectionInto
	if (isCollapsed) combinedDropInto = (ref: any) => dropGroupInto(dropConnectionInto(ref))

	return (
		<CollapsibleGroupRow
			group={group}
			isCollapsed={isCollapsed}
			toggleExpanded={toggleExpanded}
			index={index}
			acceptDragType="connection-group" // TODO - make generic
			groupApi={groupApi}
			dropInto={combinedDropInto}
			nestingLevel={nestingLevel}
		/>
	)
})
