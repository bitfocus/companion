import { useDeferredValue } from 'react'
import { ConnectDropTarget, useDrop } from 'react-dnd'
import { checkDragState, checkGridDragState, type DragState } from '../../util.js'
import type { NestingCollectionsApi } from './Types.js'

export interface CollectionsNestingTableItemDragItem {
	itemId: string
	collectionId: string | null
	index: number

	dragState: DragState | null
}
export interface CollectionsNestingTableItemDragStatus {
	isDragging: boolean
}

export function useCollectionsListItemDrop(
	collectionsApi: NestingCollectionsApi,
	dragId: string,
	collectionId: string | null,
	hoverItemId: string | null,
	hoverIndex: number,
	gridLayout: boolean
): {
	isDragging: boolean
	drop: ConnectDropTarget
} {
	const [isDragging, drop] = useDrop<CollectionsNestingTableItemDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, monitor) {
			if (hoverItemId === item.itemId) return // Don't allow dropping into the same item

			const hoverItemIdFull = hoverItemId ?? `collection-drop-${collectionId}`

			if (!gridLayout && !checkDragState(item, monitor, hoverItemIdFull)) return
			if (gridLayout && !checkGridDragState(item, monitor, hoverItemIdFull)) return

			// Time to actually perform the action
			collectionsApi.moveItemToCollection(item.itemId, collectionId, hoverIndex)

			// item.listId = listId
			item.index = hoverIndex
			item.collectionId = collectionId
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
