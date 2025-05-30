import React, { useRef } from 'react'
import { observer } from 'mobx-react-lite'
import { usePanelCollapseHelperContextForPanel } from '../../Helpers/CollapseHelper.js'
import { GroupingTableDropZone } from './GroupingTableDropZone.js'
import type { GroupingTableGroup, GroupingTableItem, GroupApi } from './Types.js'
import { useGroupListGroupDragging } from './useGroupDragging.js'
import { GroupingTableGroupRow } from './GroupingTableGroupRow.js'
import { ConnectDragPreview, ConnectDragSource, ConnectDropTarget, useDrag } from 'react-dnd'
import { GroupingTableItemDragItem, useGroupListItemDragging } from './useItemDragging.js'
import { useGroupingTableContext } from './GroupingTableContext.js'
import classNames from 'classnames'
import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { CollapsibleGroupContents } from './CollapsibleGroupContents.js'

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
						<GroupingTableNestingRow nestingLevel={nestingLevel}>
							<GroupingTableDropZone drop={drop} itemName="group" />
						</GroupingTableNestingRow>
					) : null}

					{/* Render connections in this group */}
					<CollapsibleGroupContents
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
			acceptDragType={`${dragId}-group`}
			groupApi={groupApi}
			dropInto={combinedDropInto}
			nestingLevel={nestingLevel}
		/>
	)
})

export function GroupingTableItemRow<TItem extends GroupingTableItem>({
	item,
	index,
	nestingLevel,
	children,
}: React.PropsWithChildren<{
	item: TItem
	index: number
	nestingLevel: number
}>) {
	const { dragId, groupApi } = useGroupingTableContext<TItem>()

	const { drop } = useGroupListItemDragging(groupApi, dragId, item.groupId, item.sortOrder)
	const [{ isDragging }, drag, preview] = useDrag<GroupingTableItemDragItem, unknown, { isDragging: boolean }>({
		type: dragId,
		item: {
			itemId: item.id,
			groupId: item.groupId,
			index,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	const isSelected = false // TODO - implement this

	return (
		<GroupingTableRowBase
			drag={drag}
			drop={drop}
			preview={preview}
			isDragging={isDragging}
			isSelected={isSelected}
			nestingLevel={nestingLevel}
		>
			{children}
		</GroupingTableRowBase>
	)
}

function GroupingTableRowBase({
	className,
	drag,
	drop,
	preview,
	isDragging,
	isSelected,
	nestingLevel,
	children,
}: React.PropsWithChildren<{
	className?: string
	drag: ConnectDragSource
	drop: ConnectDropTarget
	preview: ConnectDragPreview
	isDragging: boolean
	isSelected: boolean
	nestingLevel: number
}>) {
	const ref = useRef<HTMLDivElement>(null)
	preview(drop(ref))

	return (
		<GroupingTableNestingRow
			nestingLevel={nestingLevel}
			className={classNames('grouping-table-row', className, {
				'row-dragging': isDragging,
				'row-notdragging': !isDragging,
				'row-selected': isSelected,
			})}
			ref={ref}
		>
			<div ref={drag} className="row-reorder-handle">
				<FontAwesomeIcon icon={faSort} />
			</div>
			<div className="grow">{children}</div>
		</GroupingTableNestingRow>
	)
}

export function GroupingTableNestingRow({
	className,
	ref,
	nestingLevel,
	children,
}: React.PropsWithChildren<{ className?: string; ref?: React.RefObject<HTMLDivElement>; nestingLevel: number }>) {
	return (
		<div
			style={{
				// @ts-expect-error variables are not typed
				'--group-nesting-level': nestingLevel,
			}}
			className={classNames(className, {
				'collapsible-group-nesting': nestingLevel > 0,
			})}
			ref={ref}
		>
			{children}
		</div>
	)
}
