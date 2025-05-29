import React from 'react'
import { observer } from 'mobx-react-lite'
import { CollapsibleGroupContents } from '../../Components/GroupingTable/CollapsibleGroupContents.js'
import type { CollapsibleGroupItem, GroupApi } from './Types.js'
import { useGroupListItemDragging } from './useItemDragging.js'

interface CollabsibleGroupItemsProps<TItem extends CollapsibleGroupItem> {
	ItemRow: React.ComponentType<{ item: TItem; index: number; nestingLevel: number }>
	itemName: string
	groupApi: GroupApi

	items: TItem[]
	groupId: string | null
	showNoItemsMessage: boolean
	nestingLevel?: number
}

export const CollabsibleGroupItems = observer(function CollabsibleGroupItems<TItem extends CollapsibleGroupItem>({
	ItemRow,
	itemName,
	groupApi,
	items,
	groupId,
	showNoItemsMessage,
	nestingLevel = 0,
}: CollabsibleGroupItemsProps<TItem>) {
	const { isDragging, drop } = useGroupListItemDragging(groupApi, groupId)

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
