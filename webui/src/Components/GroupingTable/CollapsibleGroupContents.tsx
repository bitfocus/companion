import { faEyeSlash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { observer } from 'mobx-react-lite'
import { GroupingTableDropZone } from './GroupingTableDropZone.js'
import classNames from 'classnames'
import { GroupingTableItemRow, GroupingTableNestingRow } from './GroupingTableStuff.js'
import { GroupingTableItem } from './Types.js'
import { useGroupListItemDragging } from './useItemDragging.js'
import { useGroupingTableContext } from './GroupingTableContext.js'

interface CollapsibleGroupContentsProps<TItem extends GroupingTableItem> {
	items: TItem[]
	groupId: string | null
	showNoItemsMessage: boolean
	nestingLevel: number
}

export const CollapsibleGroupContents = observer(function CollapsibleGroupContents<TItem extends GroupingTableItem>({
	items,
	groupId,
	showNoItemsMessage,
	nestingLevel,
}: CollapsibleGroupContentsProps<TItem>) {
	const { dragId, groupApi, itemName, ItemRow } = useGroupingTableContext<TItem>()

	const { isDragging, drop } = useGroupListItemDragging(groupApi, dragId, groupId)

	let visibleCount = 0

	const itemRows = items
		// .sort((a, b) => a.sortOrder - b.sortOrder)
		.map((item, index) => {
			// TODO - this no longer works, because it returns a react node, not null...
			const childNode = <ItemRow item={item} index={index} nestingLevel={nestingLevel} />

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
				<GroupingTableNestingRow nestingLevel={nestingLevel}>
					<GroupingTableDropZone drop={drop} itemName={itemName} />
				</GroupingTableNestingRow>
			)}

			{hiddenCount > 0 && (
				<GroupingTableNestingRow nestingLevel={nestingLevel} className="grouping-table-row">
					<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
					<strong>
						{hiddenCount} {itemName}s are hidden
					</strong>
				</GroupingTableNestingRow>
			)}

			{showNoItemsMessage && items.length === 0 && !isDragging && (
				<GroupingTableNestingRow nestingLevel={nestingLevel} className="grouping-table-row">
					<FontAwesomeIcon icon={faEyeSlash} style={{ marginRight: '0.5em', color: 'gray' }} />
					<strong>This group is empty</strong>
				</GroupingTableNestingRow>
			)}
		</>
	)
})
