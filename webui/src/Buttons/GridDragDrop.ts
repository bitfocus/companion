import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { GridTransferOperation, GridTransferPair } from './GridTools/index.js'

export interface GridDropPlan {
	operation: GridTransferOperation
	pairs: GridTransferPair[]
	/** Occupied cells that will be overwritten, so the user can be asked first */
	overwrittenLocations: ControlLocation[]
}

/**
 * Work out what dropping a dragged button (or the whole selection it belongs to) means.
 *
 * The cell the drag started from lands under the cursor and everything else keeps its offset from
 * it, so what you see under the pointer is what you get - no separate anchoring rule to learn.
 *
 * Returns null when the drop should do nothing at all: it went nowhere, or part of the region would
 * land outside the grid.
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

	// Refuse the whole drop rather than silently dropping the buttons that happen to fit
	const fitsOnGrid = pairs.every(
		({ toLocation }) =>
			toLocation.row >= gridSize.minRow &&
			toLocation.row <= gridSize.maxRow &&
			toLocation.column >= gridSize.minColumn &&
			toLocation.column <= gridSize.maxColumn
	)
	if (!fitsOnGrid) return null

	const sourceKeys = new Set(sources.map(formatLocation))
	const overwrittenLocations = pairs
		.map(({ toLocation }) => toLocation)
		// A cell the region is vacating anyway is not being overwritten
		.filter((location) => !sourceKeys.has(formatLocation(location)) && isOccupied(location))

	// Dropping one button onto another trades places, the way rearranging icons does everywhere else.
	// A whole region cannot do that without scattering whatever it displaced, so it overwrites.
	const operation: GridTransferOperation = pairs.length === 1 && overwrittenLocations.length === 1 ? 'swap' : 'move'

	return { operation, pairs, overwrittenLocations }
}
