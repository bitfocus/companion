import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
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

	const pairs: GridTransferPair[] = sources.map((fromLocation) => ({
		fromLocation,
		toLocation: {
			pageNumber: destination.pageNumber,
			row: fromLocation.row + rowOffset,
			column: fromLocation.column + columnOffset,
		},
	}))

	// All or nothing: dropping only the buttons that happen to fit would quietly lose the rest
	const fitsOnGrid = pairs.every(
		({ toLocation }) =>
			toLocation.row >= gridSize.minRow &&
			toLocation.row <= gridSize.maxRow &&
			toLocation.column >= gridSize.minColumn &&
			toLocation.column <= gridSize.maxColumn
	)

	const sourceKeys = new Set(sources.map(formatLocation))
	const overwrittenLocations = pairs
		.map(({ toLocation }) => toLocation)
		// A cell the region is vacating anyway is not being overwritten
		.filter((location) => !sourceKeys.has(formatLocation(location)) && isOccupied(location))

	// Dropping one button onto another trades places, the way rearranging icons does everywhere else.
	// A whole region cannot do that without scattering whatever it displaced, so it overwrites.
	const operation: GridTransferOperation = pairs.length === 1 && overwrittenLocations.length === 1 ? 'swap' : 'move'

	return { operation, pairs, overwrittenLocations, fitsOnGrid }
}
