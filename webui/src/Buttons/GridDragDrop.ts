import { formatLocation, isLocationOnGrid } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { withoutEmptySources } from './GridGeometry.js'
import type { GridTransferOperation, GridTransferPair } from './GridTools/types.js'

export interface GridDropPlan {
	operation: GridTransferOperation
	pairs: GridTransferPair[]
	/** Occupied cells that will be overwritten, so the user can be asked first */
	overwrittenLocations: ControlLocation[]
	/** False when part of the region would land off the grid, so the drop must be refused */
	fitsOnGrid: boolean
}

/**
 * Work out what dropping a dragged button (or the whole selection it belongs to) means.
 *
 * The cell the drag started from lands under the cursor and everything else keeps its offset from
 * it, so what you see under the pointer is what you get - no separate anchoring rule to learn.
 *
 * Returns null only when the drop went nowhere at all. A region that would hang off the edge still
 * comes back described, flagged as not fitting, so the same call can both refuse the drop and show
 * the user why while they are still holding it.
 */
export function planGridDrop(
	origin: ControlLocation,
	destination: ControlLocation,
	sources: readonly ControlLocation[],
	gridSize: UserConfigGridSize,
	isOccupied: (location: ControlLocation) => boolean
): GridDropPlan | null {
	const rowOffset = destination.row - origin.row
	const columnOffset = destination.column - origin.column

	if (rowOffset === 0 && columnOffset === 0 && destination.pageNumber === origin.pageNumber) return null

	// The gaps in a selection still set where everything lands, but carry nothing of their own, so
	// they are dropped once the offsets have been worked out from them
	const pairs: GridTransferPair[] = withoutEmptySources(
		'move',
		sources.map((fromLocation) => ({
			fromLocation,
			toLocation: {
				pageNumber: destination.pageNumber,
				row: fromLocation.row + rowOffset,
				column: fromLocation.column + columnOffset,
			},
		})),
		isOccupied
	)
	if (pairs.length === 0) return null

	// All or nothing: dropping only the buttons that happen to fit would quietly lose the rest
	const fitsOnGrid = pairs.every(({ toLocation }) => isLocationOnGrid(gridSize, toLocation))

	const sourceKeys = new Set(pairs.map(({ fromLocation }) => formatLocation(fromLocation)))
	const overwrittenLocations = pairs
		.map(({ toLocation }) => toLocation)
		// A cell the region is vacating anyway is not being overwritten
		.filter((location) => !sourceKeys.has(formatLocation(location)) && isOccupied(location))

	// Dropping onto occupied cells trades places, the way rearranging icons does everywhere else: the
	// buttons that were there go back to where the dragged ones came from, so nothing is lost and
	// there is nothing to confirm. A region does this as readily as a single button - each cell
	// trades with the one it landed on.
	//
	// Unless the region is being nudged onto part of itself, where a cell is both something's source
	// and something else's destination and cannot be both ends of a trade. That is a move, and the
	// couple of cells beyond the region that it lands on are overwritten - which is what nudging a
	// block along has always meant.
	const nudgesOntoItself = pairs.some(({ toLocation }) => sourceKeys.has(formatLocation(toLocation)))
	const operation: GridTransferOperation = overwrittenLocations.length > 0 && !nudgesOntoItself ? 'swap' : 'move'

	return { operation, pairs, overwrittenLocations, fitsOnGrid }
}
