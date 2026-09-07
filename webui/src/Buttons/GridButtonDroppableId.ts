import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

/**
 * Encode a grid button location into a stable droppable id, so a DragDropProvider's
 * onDragEnd handler can recover the target location from `event.operation.target.id`.
 */
export function makeGridButtonDroppableId(pageNumber: number, column: number, row: number): string {
	return `gridbtn:${pageNumber}:${column}:${row}`
}

/**
 * Parse a droppable id produced by makeGridButtonDroppableId back into a ControlLocation.
 *
 * Matched whole rather than split and coerced: every droppable in the app passes through the same
 * drag monitor, and `Number('')` is 0, so a malformed id would otherwise quietly name a cell on
 * page 0. Rows and columns may be negative - a grid's bounds are not required to start at zero.
 */
const GRID_BUTTON_DROPPABLE_ID = /^gridbtn:(-?\d+):(-?\d+):(-?\d+)$/

export function parseGridButtonDroppableId(id: unknown): ControlLocation | null {
	if (typeof id !== 'string') return null

	const parts = GRID_BUTTON_DROPPABLE_ID.exec(id)
	if (!parts) return null

	return { pageNumber: Number(parts[1]), column: Number(parts[2]), row: Number(parts[3]) }
}
