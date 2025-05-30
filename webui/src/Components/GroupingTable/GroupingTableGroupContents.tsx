import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { GroupingTableDropZone } from './GroupingTableDropZone.js'
import { GroupingTableItemRow } from './GroupingTableRowWrappers.js'
import { GroupingTableNestingRow } from './GroupingTableNestingRow.js'
import { GroupingTableItem } from './Types.js'
import { useGroupListItemDragging } from './useItemDragging.js'
import { useGroupingTableContext } from './GroupingTableContext.js'

interface GroupingTableGroupContentsProps<TItem extends GroupingTableItem> {
	items: TItem[]
	groupId: string | null
	showNoItemsMessage: boolean
	nestingLevel: number
}

export const GroupingTableGroupContents = observer(function GroupingTableGroupContents<
	TItem extends GroupingTableItem,
>({ items, groupId, showNoItemsMessage, nestingLevel }: GroupingTableGroupContentsProps<TItem>) {
	const { dragId, groupApi, itemName, ItemRow } = useGroupingTableContext<TItem>()

	const { isDragging, drop } = useGroupListItemDragging(groupApi, dragId, groupId)

	let visibleCount = 0

	const itemRows = items
		// .sort((a, b) => a.sortOrder - b.sortOrder)
		.map((item, index) => {
			// TODO - this no longer works, because it returns a react node, not null...
			const childNode = <ItemRow item={item} index={index} />

			// Apply visibility filters
			if (!childNode) {
				return null
			}

			visibleCount++

			return (
				<GroupingTableItemRow<TItem> item={item} index={index} nestingLevel={nestingLevel}>
					{childNode}
				</GroupingTableItemRow>
			)
		})
		.filter((row) => row !== null)

	// Calculate number of hidden items
	const hiddenCount = items.length - visibleCount

	return (
		<>
			{itemRows}

			{isDragging && items.length === 0 && (
				<GroupingTableDropZone drop={drop} itemName={itemName} nestingLevel={nestingLevel} />
			)}

			{hiddenCount > 0 && (
				<div className="grouping-table-row">
					<GroupingTableNestingRow nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>
							{hiddenCount} {itemName}s are hidden
						</strong>
					</GroupingTableNestingRow>
				</div>
			)}

			{showNoItemsMessage && items.length === 0 && !isDragging && (
				<div className="grouping-table-row">
					<GroupingTableNestingRow nestingLevel={nestingLevel}>
						<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
						<strong>This group is empty</strong>
					</GroupingTableNestingRow>
				</div>
			)}
		</>
	)
})
