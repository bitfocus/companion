import { useContext, useDeferredValue } from 'react'
import { useDrop } from 'react-dnd'
import { ConnectionDragItem } from './ConnectionList.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'

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
