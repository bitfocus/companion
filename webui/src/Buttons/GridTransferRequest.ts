import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { withoutEmptySources } from './GridGeometry.js'
import type { GridTransferOperation, GridTransferPair } from './GridTools/types.js'

/** What the grid needs to know about the cells a transfer would touch */
export interface GridTransferSurroundings {
	/** Whether there is a button here at all */
	isOccupied: (location: ControlLocation) => boolean
	/** Whether every one of these lands on the grid, rather than off the edge of it */
	fitsOnGrid: (locations: ControlLocation[]) => boolean
}

export type GridTransferRequest =
	/** Nothing to carry, so there is nothing to do and nothing to say */
	| { outcome: 'nothing' }
	/** Some of it would land where nothing can reach it, so none of it goes */
	| { outcome: 'off-grid'; pairs: GridTransferPair[]; offGrid: GridTransferPair[] }
	/** It would replace buttons that are already there, which is worth asking about first */
	| { outcome: 'overwrites'; pairs: GridTransferPair[]; overwritten: GridTransferPair[] }
	| { outcome: 'ready'; pairs: GridTransferPair[] }

/**
 * Decide what a transfer would actually do, before any of it happens.
 *
 * Every way of moving buttons around the grid - the toolbar tools, dragging, pasting, the context
 * menu - goes through this, so the things that must never happen quietly are decided in one place
 * rather than in each of them. It only reports; applying, refusing and asking are the caller's.
 */
export function planGridTransferRequest(
	operation: GridTransferOperation,
	pairs: GridTransferPair[],
	{ isOccupied, fitsOnGrid }: GridTransferSurroundings
): GridTransferRequest {
	// The gaps in a region are its shape, not its contents - they set where the buttons around them
	// land and have nothing of their own to place
	const carrying = withoutEmptySources(operation, pairs, isOccupied)
	if (carrying.length === 0) return { outcome: 'nothing' }

	// Off the grid is out of reach. Refusing the whole thing rather than the part that fits means a
	// move can never destroy its source in exchange for nothing.
	const offGrid = carrying.filter(({ toLocation }) => !fitsOnGrid([toLocation]))
	if (offGrid.length > 0) return { outcome: 'off-grid', pairs: carrying, offGrid }

	// A swap trades rather than destroys, and a cell the buttons are vacating anyway is not being
	// overwritten by them
	const vacated = new Set(operation === 'move' ? carrying.map((pair) => formatLocation(pair.fromLocation)) : [])
	const overwritten =
		operation === 'swap'
			? []
			: carrying.filter(({ toLocation }) => !vacated.has(formatLocation(toLocation)) && isOccupied(toLocation))

	if (overwritten.length > 0) return { outcome: 'overwrites', pairs: carrying, overwritten }

	return { outcome: 'ready', pairs: carrying }
}
