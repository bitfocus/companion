import { useDeferredValue } from 'react'
import { useDrop } from 'react-dnd'
import type { DragState } from '../../util.js'
import type { GroupApi } from './Types.js'

export interface GroupingTableItemDragItem {
	itemId: string
	groupId: string | null
	index: number

	dragState: DragState | null
}
export interface GroupingTableItemDragStatus {
	isDragging: boolean
}

export function useGroupListItemDragging(
	groupApi: GroupApi,
	dragId: string,
	groupId: string | null,
	dropIndex: number = 0
) {
	const [isDragging, drop] = useDrop<GroupingTableItemDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			// Can't move into itself
			// if (ownerId && isEqual(item.connectionId, ownerId.parentId)) return

			// Time to actually perform the action
			groupApi.moveItemToGroup(item.itemId, groupId, dropIndex)

			// item.listId = listId
			item.index = dropIndex
			item.groupId = groupId
		},
	})

	// Defer the isDragging value to ensure dragend doesn't fire prematurely
	// See https://github.com/bitfocus/companion/issues/3115
	// https://bugs.webkit.org/show_bug.cgi?id=134212
	// https://issues.chromium.org/issues/41150279
	const isDraggingDeferred = useDeferredValue(isDragging)

	return {
		isDragging: isDraggingDeferred,
		drop,
	}
}
