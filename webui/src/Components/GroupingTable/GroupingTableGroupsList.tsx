import React from 'react'
import { observer } from 'mobx-react-lite'
import { usePanelCollapseHelperContextForPanel } from '../../Helpers/CollapseHelper.js'
import { GroupingTableDropZone } from './GroupingTableDropZone.js'
import type { GroupingTableGroup, GroupingTableItem } from './Types.js'
import { useGroupListGroupDrop } from './useGroupDrop.js'
import { GroupingTableGroupRow } from './GroupingTableGroupRow.js'
import { useGroupingTableContext } from './GroupingTableContext.js'
import { GroupingTableGroupContents } from './GroupingTableGroupContents.js'

interface GroupingTableGroupsListProps<TGroup extends GroupingTableGroup, TItem extends GroupingTableItem> {
	groups: TGroup[]
	parentId: string | null
	groupedItems: Map<string, TItem[]>
	nestingLevel: number
}

export const GroupingTableGroupsList = observer(function GroupingTableGroupsList<
	TGroup extends GroupingTableGroup,
	TItem extends GroupingTableItem,
>({ groups, parentId, groupedItems, nestingLevel }: GroupingTableGroupsListProps<TGroup, TItem>) {
	return (
		<>
			{groups.map((childGroup) => (
				<GroupingTableGroupSingle
					key={childGroup.id}
					group={childGroup}
					parentId={parentId}
					groupedItems={groupedItems}
					nestingLevel={nestingLevel}
				/>
			))}
		</>
	)
})

interface GroupingTableGroupSingleProps<TGroup extends GroupingTableGroup, TItem extends GroupingTableItem> {
	group: TGroup
	parentId: string | null
	groupedItems: Map<string, TItem[]>
	nestingLevel: number
}

// Note: mobx seems to get upset when a component is called recursively, without an intermediate component
const GroupingTableGroupSingle = observer(function GroupingTableGroupSingle<
	TGroup extends GroupingTableGroup,
	TItem extends GroupingTableItem,
>({ group, parentId, groupedItems, nestingLevel }: GroupingTableGroupSingleProps<TGroup, TItem>) {
	const { dragId, groupApi } = useGroupingTableContext<TItem>()

	const { canDrop, dragGroupId, drop } = useGroupListGroupDrop(groupApi, dragId, group.id)

	const collapseHelper = usePanelCollapseHelperContextForPanel(null, group.id)

	const isCollapsed = collapseHelper.isCollapsed || (!!dragGroupId && dragGroupId === group.id)
	const itemsInGroup = groupedItems.get(group.id) || []

	return (
		<>
			<GroupingTableGroupRow
				groupApi={groupApi}
				group={group}
				parentId={parentId}
				toggleExpanded={collapseHelper.toggleCollapsed}
				isCollapsed={isCollapsed}
				nestingLevel={nestingLevel}
			/>

			{!isCollapsed && (
				<>
					<GroupingTableGroupsList
						groups={group.children}
						parentId={group.id}
						groupedItems={groupedItems}
						nestingLevel={nestingLevel + 1}
					/>

					{canDrop && (!group.children || group.children.length === 0) ? (
						<GroupingTableDropZone drop={drop} itemName="group" nestingLevel={nestingLevel + 1} />
					) : null}

					{/* Render connections in this group */}
					<GroupingTableGroupContents
						items={itemsInGroup}
						groupId={group.id}
						showNoItemsMessage={group.children.length === 0}
						nestingLevel={nestingLevel + 1}
					/>
				</>
			)}
		</>
	)
})
