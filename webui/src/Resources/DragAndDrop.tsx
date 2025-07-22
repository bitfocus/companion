import type { DropTargetMonitor, XYCoord } from 'react-dnd'

export interface DragState {
	draggedOver: string[]
	dragDownwards: boolean
	lastCoords: XYCoord
}

/**
 * Checks if a drag operation should trigger a state change
 * @returns boolean if the drag should be processed, or a DragPlacement indicating placement location
 */
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

	// Initialize or reset dragState when direction changes
	if (!item.dragState || item.dragState.dragDownwards !== isDownwards) {
		item.dragState = {
			dragDownwards: isDownwards,
			draggedOver: [],
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

/**
 * Result of the checkDragState function indicating how the item should be placed
 */
export enum DragPlacement {
	/** Insert after the current item */
	After = 'after',
	/** Insert before the current item */
	Before = 'before',
}

export interface CheckDragStateWithThresholdsOptions {
	/** The drop rectangle, if wanting to use midpoint detection */
	dropRectangle: DOMRect
	/** Top percentage of row for "insert before" zone (default: 0.2 or 20%) */
	topZoneThreshold?: number
	/** Bottom percentage of row for "insert after" zone (default: 0.2 or 20%) */
	bottomZoneThreshold?: number
}

/**
 * Checks if a drag operation should trigger a state change
 * @returns boolean if the drag should be processed, or a DragPlacement indicating placement location
 */
export function checkDragStateWithThresholds<TItem extends { dragState: DragState | null }>(
	item: TItem,
	monitor: DropTargetMonitor,
	hoverId: string,
	options: CheckDragStateWithThresholdsOptions
): DragPlacement | null {
	const currentCoords = monitor.getClientOffset()
	const previousCoords = item.dragState?.lastCoords ?? monitor.getInitialClientOffset()
	if (!previousCoords || !currentCoords) return null

	if (currentCoords.y === previousCoords.y) return null
	const isDownwards = currentCoords.y > previousCoords.y

	// Initialize or reset dragState when direction changes
	if (!item.dragState || item.dragState.dragDownwards !== isDownwards) {
		item.dragState = {
			dragDownwards: isDownwards,
			draggedOver: [],
			lastCoords: currentCoords,
		}
	} else {
		item.dragState.lastCoords = currentCoords
	}

	const rect = options.dropRectangle
	const topThreshold = options?.topZoneThreshold ?? 0.2 // Default 20% for top zone
	const bottomThreshold = options?.bottomZoneThreshold ?? 0.2 // Default 20% for bottom zone

	// Calculate relative position within the element
	const relativeY = (currentCoords.y - rect.y) / rect.height

	// Check if we've crossed the midpoint
	const midpoint = rect.y + rect.height / 2
	const hasCrossedMidpoint =
		(previousCoords.y < midpoint && currentCoords.y >= midpoint) ||
		(previousCoords.y >= midpoint && currentCoords.y < midpoint)

	// Determine placement based on position
	let placement: DragPlacement
	let zoneId: string

	if (relativeY < topThreshold) {
		// Top zone - always place before
		placement = DragPlacement.Before
		zoneId = `${hoverId}-top`
	} else if (relativeY > 1 - bottomThreshold) {
		// Bottom zone - always place after
		placement = DragPlacement.After
		zoneId = `${hoverId}-bottom`
	} else {
		// Middle zone - use direction-based logic
		// When dragging down, place after. When dragging up, place before.
		placement = isDownwards ? DragPlacement.After : DragPlacement.Before

		// Only trigger on a midpoint crossing to prevent jitter
		if (!hasCrossedMidpoint) {
			return null
		}

		zoneId = `${hoverId}-mid-${isDownwards ? 'down' : 'up'}`
	}

	// Don't repeat the same hover operation on the same element+zone
	if (item.dragState.draggedOver.includes(zoneId)) {
		return null
	}

	item.dragState.draggedOver.push(zoneId)

	// Return the placement information
	return placement
}

export function checkGridDragState<TItem extends { dragState: DragState | null }>(
	item: TItem,
	monitor: DropTargetMonitor,
	hoverId: string,
	threshold: number = 10
): boolean {
	const currentCoords = monitor.getClientOffset()
	const previousCoords = item.dragState?.lastCoords ?? monitor.getInitialClientOffset()
	if (!previousCoords || !currentCoords) return false

	// Calculate the distance moved since last significant movement
	const deltaX = Math.abs(currentCoords.x - previousCoords.x)
	const deltaY = Math.abs(currentCoords.y - previousCoords.y)
	const totalMovement = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

	// Only process if we've moved enough distance (prevents jitter)
	if (totalMovement < threshold) {
		return false
	}

	if (!item.dragState) {
		item.dragState = {
			draggedOver: [],
			lastCoords: currentCoords,
			dragDownwards: false,
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
