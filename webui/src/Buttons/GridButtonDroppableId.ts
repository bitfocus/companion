import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

/**
 * Encode a grid button location into a stable droppable id, so a DragDropProvider's
 * onDragEnd handler can recover the target location from `event.operation.target.id`.
 */
export function makeGridButtonDroppableId(pageNumber: number, column: number, row: number): string {
	return `gridbtn:${pageNumber}:${column}:${row}`
}

/** Parse a droppable id produced by makeGridButtonDroppableId back into a ControlLocation */
export function parseGridButtonDroppableId(id: unknown): ControlLocation | null {
	if (typeof id !== 'string') return null
	const parts = id.split(':')
	if (parts.length !== 4 || parts[0] !== 'gridbtn') return null
	const pageNumber = Number(parts[1])
	const column = Number(parts[2])
	const row = Number(parts[3])
	if (!Number.isInteger(pageNumber) || !Number.isInteger(column) || !Number.isInteger(row)) return null
	return { pageNumber, column, row }
}
