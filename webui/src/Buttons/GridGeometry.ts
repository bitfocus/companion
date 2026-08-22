import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { GridTransferOperation, GridTransferPair } from './GridTools/types.js'

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

/**
 * Which cell of a region the destination names.
 *
 * `center` reads as "put it here", and is right wherever the region is drawn under the cursor as it
 * moves: what lands where is visible before the click, so there is no rule to know. Without that
 * picture - pasting at a cell, where the destination was named rather than pointed at - `top-left`
 * is the one that can be predicted, and the one that can reach the corners of the grid: centring a
 * 3x3 on the top-left cell would need a row above the grid, and be refused.
 *
 * The two agree exactly for a single button, which is most of what either ever carries.
 */
export type GridPlacementAnchor = 'top-left' | 'center'

/**
 * Map each source onto the destination, with the anchor cell of the sources' bounding box landing on
 * the destination. A single source therefore lands exactly where it was put, and a region keeps its
 * shape.
 *
 * A region with an even number of rows or columns has no middle cell, so `center` takes the upper
 * left of the two - which is also what keeps it agreeing with `top-left` for a single button.
 */
export function buildTransferPairs(
	sources: ControlLocation[],
	destination: ControlLocation,
	anchor: GridPlacementAnchor
): GridTransferPair[] {
	const minRow = Math.min(...sources.map((l) => l.row))
	const minColumn = Math.min(...sources.map((l) => l.column))
	const maxRow = Math.max(...sources.map((l) => l.row))
	const maxColumn = Math.max(...sources.map((l) => l.column))

	const rowAnchor = anchor === 'center' ? Math.floor((maxRow - minRow) / 2) : 0
	const columnAnchor = anchor === 'center' ? Math.floor((maxColumn - minColumn) / 2) : 0

	return sources.map((fromLocation) => ({
		fromLocation,
		toLocation: {
			pageNumber: destination.pageNumber,
			row: destination.row + (fromLocation.row - minRow) - rowAnchor,
			column: destination.column + (fromLocation.column - minColumn) - columnAnchor,
		},
	}))
}

/**
 * What the grid would look like with these pairs applied: each cell that changes, and where the
 * button arriving there is coming from.
 *
 * A swap moves buttons both ways, so both ends are described - otherwise the preview would show what
 * you are placing but not what it is displacing.
 */
export function previewPlacements(
	operation: GridTransferOperation,
	pairs: GridTransferPair[]
): Map<string, ControlLocation> {
	const placements = new Map<string, ControlLocation>()

	for (const { fromLocation, toLocation } of pairs) {
		placements.set(formatLocation(toLocation), fromLocation)
		if (operation === 'swap') placements.set(formatLocation(fromLocation), toLocation)
	}

	return placements
}

/**
 * Drop the pairs that have nothing to carry.
 *
 * The gaps in a region are its shape, not its contents: they decide where the buttons around them
 * land, and then they have nothing of their own to place. Letting them clear what they land on turns
 * "copy these five buttons" into "and wipe whatever was in the gaps between them", which is never
 * what drawing a box around a handful of buttons meant.
 *
 * A swap is the exception - trading with an empty cell is how a button is moved into one, and it
 * destroys nothing either way.
 *
 * The backend applies the same rule, so this is about what the grid shows and warns about rather
 * than what it is allowed to do.
 */
export function withoutEmptySources(
	operation: GridTransferOperation,
	pairs: GridTransferPair[],
	isOccupied: (location: ControlLocation) => boolean
): GridTransferPair[] {
	if (operation === 'swap') return pairs

	return pairs.filter(({ fromLocation }) => isOccupied(fromLocation))
}
