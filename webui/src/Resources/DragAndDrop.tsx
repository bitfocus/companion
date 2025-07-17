import type { DropTargetMonitor, XYCoord } from 'react-dnd'

export interface DragState {
	draggedOver: string[]
	dragDownwards: boolean
	lastCoords: XYCoord
}

export function checkDragState<TItem extends { dragState: DragState | null }>(
	item: TItem,
	monitor: DropTargetMonitor,
	hoverId: string
): boolean {
	const currentCoords = monitor.getClientOffset()
	const previousCoords = item.dragState?.lastCoords ?? monitor.getInitialClientOffset()
	if (!previousCoords || !currentCoords) return false

	if (currentCoords.y === previousCoords.y) return false
	const isDownwards = currentCoords.y > previousCoords.y

	if (!item.dragState || item.dragState.dragDownwards !== isDownwards) {
		item.dragState = {
			dragDownwards: isDownwards,
			draggedOver: item.dragState ? [hoverId] : [], // If we're changing direction, reset the draggedOver list but don't trigger again for what is currently hovered
			lastCoords: currentCoords,
		}
	} else {
		item.dragState.lastCoords = currentCoords
	}

	// Don't repeat the same swap
	if (item.dragState.draggedOver.includes(hoverId)) {
		return false
	}
	item.dragState.draggedOver.push(hoverId)

	return true
}
