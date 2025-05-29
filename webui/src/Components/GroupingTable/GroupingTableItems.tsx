import React from 'react'
import { observer } from 'mobx-react-lite'
import { CollapsibleGroupContents } from './CollapsibleGroupContents.js'
import type { GroupingTableItem } from './Types.js'
import { useGroupListItemDragging } from './useItemDragging.js'
import { useGroupingTableContext } from './GroupingTableContext.js'

interface CollabsibleGroupItemsProps<TItem extends GroupingTableItem> {
	items: TItem[]
	groupId: string | null
	showNoItemsMessage: boolean
	nestingLevel?: number
}

export const CollabsibleGroupItems = observer(function CollabsibleGroupItems<TItem extends GroupingTableItem>({
	items,
	groupId,
	showNoItemsMessage,
	nestingLevel = 0,
}: CollabsibleGroupItemsProps<TItem>) {
	const { dragId, groupApi, itemName, ItemRow } = useGroupingTableContext<TItem>()

	const { isDragging, drop } = useGroupListItemDragging(groupApi, dragId, groupId)

	return (
		<CollapsibleGroupContents<TItem>
			items={items}
			showNoItemsMessage={showNoItemsMessage}
			itemName={itemName}
			nestingLevel={nestingLevel}
			isDragging={isDragging}
			drop={drop}
		>
			{(item, index) => {
				// TODO - avoid this function
				return <ItemRow key={item.id} item={item} index={index} nestingLevel={nestingLevel} />
			}}
		</CollapsibleGroupContents>
	)
})
