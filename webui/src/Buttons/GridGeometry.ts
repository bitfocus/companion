import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

/** Every cell in the rectangle with these two locations at opposite corners */
export function locationsInRectangle(from: ControlLocation, to: ControlLocation): ControlLocation[] {
	const minRow = Math.min(from.row, to.row)
	const maxRow = Math.max(from.row, to.row)
	const minColumn = Math.min(from.column, to.column)
	const maxColumn = Math.max(from.column, to.column)

	const locations: ControlLocation[] = []
	for (let row = minRow; row <= maxRow; row++) {
		for (let column = minColumn; column <= maxColumn; column++) {
			locations.push({ pageNumber: to.pageNumber, row, column })
		}
	}
	return locations
}
