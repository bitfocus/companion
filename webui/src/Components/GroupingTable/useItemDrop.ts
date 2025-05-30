import { useDeferredValue } from 'react'
import { useDrop } from 'react-dnd'
import { checkDragState, type DragState } from '../../util.js'
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

export function useGroupListItemDrop(
	groupApi: GroupApi,
	dragId: string,
	groupId: string | null,
	hoverItemId: string | null,
	hoverIndex: number
) {
	const [isDragging, drop] = useDrop<GroupingTableItemDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, monitor) {
			if (hoverItemId === item.itemId) return // Don't allow dropping into the same item

			if (!checkDragState(item, monitor, hoverItemId ?? `group-drop-${groupId}`)) return

			// Time to actually perform the action
			groupApi.moveItemToGroup(item.itemId, groupId, hoverIndex)

			// item.listId = listId
			item.index = hoverIndex
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
