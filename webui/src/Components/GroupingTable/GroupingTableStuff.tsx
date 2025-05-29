import React from 'react'
import { observer } from 'mobx-react-lite'
import { usePanelCollapseHelperContextForPanel } from '../../Helpers/CollapseHelper.js'
import { GroupingTableDropZone } from './GroupingTableDropZone.js'
import { CollabsibleGroupItems } from './GroupingTableItems.js'
import type { GroupingTableGroup, GroupingTableItem, GroupApi } from './Types.js'
import { useGroupListGroupDragging } from './useGroupDragging.js'
import { GroupingTableGroupRow } from './GroupingTableGroupRow.js'
import { ConnectDropTarget } from 'react-dnd'
import { useGroupListItemDragging } from './useItemDragging.js'
import { useGroupingTableContext } from './GroupingTableContext.js'

interface GroupingTableGroupArrayProps<TGroup extends GroupingTableGroup, TItem extends GroupingTableItem> {
	groups: TGroup[]
	groupedItems: Map<string, TItem[]>
	nestingLevel: number
}

export const GroupingTableGroupArray = observer(function GroupingTableGroupArray<
	TGroup extends GroupingTableGroup,
	TItem extends GroupingTableItem,
>({ groups, groupedItems, nestingLevel }: GroupingTableGroupArrayProps<TGroup, TItem>) {
	return (
		<>
			{groups.map((childGroup, childIndex) => (
				<GroupingTableGroupSingle
					key={childGroup.id}
					index={childIndex}
					group={childGroup}
					groupedItems={groupedItems}
					nestingLevel={nestingLevel}
				/>
			))}
		</>
	)
})

interface GroupingTableGroupSingleProps<TGroup extends GroupingTableGroup, TItem extends GroupingTableItem> {
	index: number
	group: TGroup
	groupedItems: Map<string, TItem[]>
	nestingLevel?: number
}

// Note: mobx seems to get upset when a component is called recursively, without an intermediate component
const GroupingTableGroupSingle = observer(function GroupingTableGroupSingle<
	TGroup extends GroupingTableGroup,
	TItem extends GroupingTableItem,
>({ index, group, groupedItems, nestingLevel = 0 }: GroupingTableGroupSingleProps<TGroup, TItem>) {
	const { dragId, groupApi } = useGroupingTableContext<TItem>()

	const { isOver, canDrop, dragGroupId, drop } = useGroupListGroupDragging(groupApi, dragId, group.id)

	const collapseHelper = usePanelCollapseHelperContextForPanel(null, group.id)

	const isCollapsed = collapseHelper.isCollapsed || (!!dragGroupId && dragGroupId === group.id)
	const itemsInGroup = groupedItems.get(group.id) || []

	return (
		<>
			<GroupingTableGroupRow2
				groupApi={groupApi}
				group={group}
				toggleExpanded={collapseHelper.toggleCollapsed}
				isCollapsed={isCollapsed}
				index={index}
				nestingLevel={nestingLevel}
			/>

			{!isCollapsed && (
				<>
					<GroupingTableGroupArray
						groups={group.children}
						groupedItems={groupedItems}
						nestingLevel={nestingLevel + 1}
					/>

					{canDrop && (!group.children || group.children.length === 0) ? (
						<GroupingTableDropZone drop={drop} itemName="group" />
					) : null}

					{/* Render connections in this group */}
					<CollabsibleGroupItems
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

interface GroupingTableGroupRow2Props {
	group: GroupingTableGroup
	toggleExpanded: () => void
	groupApi: GroupApi
	isCollapsed: boolean
	index: number
	nestingLevel: number
}
const GroupingTableGroupRow2 = observer(function GroupingTableGroupRow2({
	group,
	toggleExpanded,
	groupApi,
	isCollapsed,
	index,
	nestingLevel,
}: GroupingTableGroupRow2Props) {
	const { dragId } = useGroupingTableContext<GroupingTableItem>()
	const { drop: dropConnectionInto } = useGroupListItemDragging(groupApi, dragId, group.id, -1)
	const { isOver, canDrop, drop: dropGroupInto } = useGroupListGroupDragging(groupApi, dragId, group.id)

	// Function that combines both drop targets
	let combinedDropInto: ConnectDropTarget = dropConnectionInto
	if (isCollapsed) combinedDropInto = (ref: any) => dropGroupInto(dropConnectionInto(ref))

	return (
		<GroupingTableGroupRow
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
