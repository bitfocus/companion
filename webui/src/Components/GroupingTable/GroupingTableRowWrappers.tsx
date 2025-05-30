import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useRef } from 'react'
import { useDrag, ConnectDragSource, ConnectDropTarget, ConnectDragPreview } from 'react-dnd'
import { useGroupingTableContext } from './GroupingTableContext.js'
import { GroupingTableNestingRow } from './GroupingTableNestingRow.js'
import type { GroupingTableGroup, GroupingTableItem } from './Types.js'
import { useGroupListItemDrop, GroupingTableItemDragItem } from './useItemDrop.js'
import { GroupingTableGroupDragItem } from './useGroupDrop.js'
import { observer } from 'mobx-react-lite'

export const GroupingTableItemRow = observer(function GroupingTableItemRow<TItem extends GroupingTableItem>({
	item,
	index,
	nestingLevel,
	children,
}: React.PropsWithChildren<{
	item: TItem
	index: number
	nestingLevel: number
}>) {
	const { dragId, groupApi, selectedItemId } = useGroupingTableContext<TItem>()

	const { drop } = useGroupListItemDrop(groupApi, dragId, item.groupId, item.id, index)
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

	return (
		<GroupingTableRowBase
			drag={drag}
			drop={drop}
			preview={preview}
			isDragging={isDragging}
			isSelected={item.id === selectedItemId}
			nestingLevel={nestingLevel}
			className="grouping-table-row-item"
		>
			{children}
		</GroupingTableRowBase>
	)
})

export const GroupingTableGroupRowWrapper = observer(function GroupingTableGroupRowWrapper<
	TGroup extends GroupingTableGroup,
>({
	group,
	parentId,
	nestingLevel,
	children,
}: React.PropsWithChildren<{
	group: TGroup
	parentId: string | null
	nestingLevel: number
}>) {
	const { dragId, groupApi } = useGroupingTableContext<GroupingTableItem>()

	// Allow dropping items onto the group, to add them to the group
	const { drop } = useGroupListItemDrop(groupApi, dragId, group.id, null, -1)

	const [{ isDragging }, drag, preview] = useDrag<GroupingTableGroupDragItem, unknown, { isDragging: boolean }>({
		type: `${dragId}-group`,
		item: {
			groupId: group.id,
			parentId: parentId,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})

	return (
		<GroupingTableRowBase
			drag={drag}
			drop={drop}
			preview={preview}
			isDragging={isDragging}
			isSelected={false}
			nestingLevel={nestingLevel}
			className="grouping-table-row-group"
		>
			{children}
		</GroupingTableRowBase>
	)
})

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
	className: string
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
		<div
			className={classNames(className, {
				'row-dragging': isDragging,
				'row-notdragging': !isDragging,
				'row-selected': isSelected,
			})}
			ref={ref}
		>
			<GroupingTableNestingRow nestingLevel={nestingLevel}>
				<div ref={drag} className="row-reorder-handle">
					<FontAwesomeIcon icon={faSort} />
				</div>
				<div className="grow">{children}</div>
			</GroupingTableNestingRow>
		</div>
	)
}
