import { useContext, useDeferredValue } from 'react'
import { useDrop } from 'react-dnd'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'
import { checkDragState, DragState } from '../../util.js'

export interface ConnectionDragItem {
	connectionId: string
	groupId: string | null
	index: number

	dragState: DragState | null
}
export interface ConnectionDragStatus {
	isDragging: boolean
}

export interface ConnectionGroupDragItem {
	groupId: string
	parentId: string | null
	dragState: DragState | null
}
export interface ConnectionGroupDragStatus {
	isDragging: boolean
}

export function useConnectionListDragging(groupId: string | null, dropIndex: number = 0) {
	const { socket } = useContext(RootAppStoreContext)

	const [isDragging, drop] = useDrop<ConnectionDragItem, unknown, boolean>({
		accept: 'connection',
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			// Can't move into itself
			// if (ownerId && isEqual(item.connectionId, ownerId.parentId)) return

			// Time to actually perform the action
			socket.emitPromise('connections:reorder', [groupId, item.connectionId, dropIndex]).catch((e) => {
				console.error('Reorder failed', e)
			})

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

// For handling group drag and drop, including parent-child relationships
export function useGroupListDragging(groupId: string | null) {
	const { socket } = useContext(RootAppStoreContext)

	const [{ isOver, canDrop, dragGroupId }, drop] = useDrop<
		ConnectionGroupDragItem,
		unknown,
		{ isOver: boolean; canDrop: boolean; dragGroupId: string | undefined }
	>({
		accept: 'connection-group',
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
			dragGroupId: monitor.canDrop() ? monitor.getItem()?.groupId : undefined,
		}),
		hover(item, monitor) {
			// If this is the root area (groupId is null), make the dropped group top-level

			console.log('hover', groupId, item.groupId)

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			if (!checkDragState(item, monitor, `${groupId}-content`)) return

			if (groupId === item.parentId) return // Don't allow dropping into the same group

			if (item.groupId !== null) {
				socket.emitPromise('connection-groups:reorder', [item.groupId, groupId, -1]).catch((e) => {
					console.error('Failed to set group parent', e)
				})
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
