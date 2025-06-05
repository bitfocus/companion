import { useDrop } from 'react-dnd'
import { checkDragState, DragState } from '../../util.js'
import { GroupApi } from './Types.js'

export interface GroupingTableGroupDragItem {
	groupId: string
	parentId: string | null
	dragState: DragState | null
}
// export interface GroupingTableGroupDragStatus {
// 	isDragging: boolean
// }

// For handling group drag and drop, including parent-child relationships
export function useGroupListGroupDrop(groupApi: GroupApi, dragId: string, groupId: string | null) {
	const [{ isOver, canDrop, dragGroupId }, drop] = useDrop<
		GroupingTableGroupDragItem,
		unknown,
		{ isOver: boolean; canDrop: boolean; dragGroupId: string | undefined }
	>({
		accept: `${dragId}-group`,
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
			dragGroupId: monitor.canDrop() ? monitor.getItem()?.groupId : undefined,
		}),
		hover(item, monitor) {
			// If this is the root area (groupId is null), make the dropped group top-level

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			if (!checkDragState(item, monitor, `${groupId}-content`)) return

			if (groupId === item.parentId) return // Don't allow dropping into the same group

			if (item.groupId !== null) {
				groupApi.moveGroup(item.groupId, groupId, -1)
				return { parentChanged: true }
			}
			return {} // Always return an object
		},
	})

	return {
		isOver,
		canDrop,
		dragGroupId,
		drop,
	}
}
