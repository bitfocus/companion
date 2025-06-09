import { ConnectDropTarget, useDrop } from 'react-dnd'
import { checkDragState, DragState } from '../../util.js'
import { NestingCollectionsApi } from './Types.js'

export interface CollectionsNestingTableCollectionDragItem {
	collectionId: string
	parentId: string | null
	dragState: DragState | null
}
// export interface CollectionsNestingTableCollectionDragStatus {
// 	isDragging: boolean
// }

// For handling group drag and drop, including parent-child relationships
export function useCollectionListCollectionDrop(
	collectionApi: NestingCollectionsApi,
	dragId: string,
	collectionId: string | null
): {
	isOver: boolean
	canDrop: boolean
	dragCollectionId: string | undefined
	drop: ConnectDropTarget
} {
	const [{ isOver, canDrop, dragCollectionId }, drop] = useDrop<
		CollectionsNestingTableCollectionDragItem,
		unknown,
		{ isOver: boolean; canDrop: boolean; dragCollectionId: string | undefined }
	>({
		accept: `${dragId}-collection`,
		collect: (monitor) => ({
			isOver: monitor.isOver(),
			canDrop: monitor.canDrop(),
			dragCollectionId: monitor.canDrop() ? monitor.getItem()?.collectionId : undefined,
		}),
		hover(item, monitor) {
			// If this is the root area (collectionId is null), make the dropped collectionId top-level

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			if (!checkDragState(item, monitor, `${collectionId}-content`)) return

			if (collectionId === item.parentId) return // Don't allow dropping into the same collectionId

			if (item.collectionId !== null) {
				collectionApi.moveCollection(item.collectionId, collectionId, -1)
				return { parentChanged: true }
			}
			return {} // Always return an object
		},
	})

	return {
		isOver,
		canDrop,
		dragCollectionId,
		drop,
	}
}
