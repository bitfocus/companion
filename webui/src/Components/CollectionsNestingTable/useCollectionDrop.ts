import { ConnectDropTarget, useDrop } from 'react-dnd'
import { checkDragState, DragState } from '~/Resources/DragAndDrop.js'
import { NestingCollectionsApi } from './Types.js'

export interface CollectionsNestingTableCollectionDragItem {
	collectionId: string
	index: number
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
	parentId: string | null,
	index: number,
	collectionId: string,
	enabled: boolean
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
			if (!enabled) return

			// If this is the root area (collectionId is null), make the dropped collectionId top-level

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			if (!checkDragState(item, monitor, `${parentId}-${collectionId}`)) return

			if (parentId === item.parentId && (index === -1 || index === item.index)) return // Don't allow dropping into the same collectionId

			if (item.collectionId !== null) {
				collectionApi.moveCollection(item.collectionId, parentId, index)
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
