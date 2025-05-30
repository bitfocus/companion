import { faSort } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useRef } from 'react'
import { useDrag, ConnectDragSource, ConnectDropTarget, ConnectDragPreview } from 'react-dnd'
import { useGroupingTableContext } from './GroupingTableContext.js'
import { GroupingTableNestingRow } from './GroupingTableNestingRow.js'
import type { GroupingTableItem } from './Types.js'
import { useGroupListItemDragging, GroupingTableItemDragItem } from './useItemDragging.js'

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
		<div
			className={classNames('grouping-table-row', className, {
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
