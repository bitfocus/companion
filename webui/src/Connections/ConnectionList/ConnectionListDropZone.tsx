import React, { useContext, useDeferredValue } from 'react'
import { useDrop } from 'react-dnd'
import { ConnectionDragItem } from './ConnectionList.js'
import { RootAppStoreContext } from '../../Stores/RootAppStore.js'

interface ConnectionDropPlaceholderZoneProps {
	groupId: string | null
	connectionCount: number
}

export function ConnectionDropPlaceholderZone({
	groupId,
	connectionCount,
	children,
}: React.PropsWithChildren<ConnectionDropPlaceholderZoneProps>) {
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
			socket.emitPromise('connections:reorder', [groupId, item.connectionId, 0]).catch((e) => {
				console.error('Reorder failed', e)
			})

			// item.listId = listId
			item.index = 0
			item.groupId = groupId
		},
	})

	// Defer the isDragging value to ensure dragend doesn't fire prematurely
	// See https://github.com/bitfocus/companion/issues/3115
	// https://bugs.webkit.org/show_bug.cgi?id=134212
	// https://issues.chromium.org/issues/41150279
	const isDraggingDeferred = useDeferredValue(isDragging)

	if (!isDraggingDeferred || connectionCount > 0) return <>{children}</>

	return (
		<tr ref={drop} className="connectionlist-dropzone">
			<td colSpan={6}>
				<p>Drop connection here</p>
			</td>
		</tr>
	)
}
