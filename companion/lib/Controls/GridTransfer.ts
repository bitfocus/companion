import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'

export type GridTransferOperation = 'copy' | 'move' | 'swap'

export interface GridTransferPair {
	fromLocation: ControlLocation
	toLocation: ControlLocation
}

/** What should end up at one location once the transfer is applied */
export type GridPlacement =
	| { location: ControlLocation; kind: 'empty' }
	/** An existing control moves here */
	| { location: ControlLocation; kind: 'existing'; controlId: string }
	/** A fresh control, cloned from this one, is placed here */
	| { location: ControlLocation; kind: 'clone'; sourceControlId: string }

export interface GridTransferPlan {
	/** Every location whose occupant changes, and what will be there afterwards */
	placements: GridPlacement[]
	/** Controls that end up nowhere once this is applied, and so must be deleted */
	discardedControlIds: string[]
}

export class GridTransferError extends Error {}

/**
 * Work out what a batch transfer will do, before any of it happens.
 *
 * The whole plan is computed against the *starting* state, which is what makes overlapping source
 * and destination regions well defined - nudging a block of buttons one column across reads every
 * source before it writes anything, rather than dragging the first button over the second.
 *
 * Pure, so the semantics can be tested without a controls tree.
 */
export function planGridTransfer(
	operation: GridTransferOperation,
	pairs: GridTransferPair[],
	getControlIdAt: (location: ControlLocation) => string | null
): GridTransferPlan {
	// A pair that goes nowhere is a no-op rather than an error, matching what the single-location
	// endpoints have always done
	const realPairs = pairs.filter(
		({ fromLocation, toLocation }) => formatLocation(fromLocation) !== formatLocation(toLocation)
	)

	const seenDestinations = new Set<string>()
	for (const { toLocation } of realPairs) {
		const key = formatLocation(toLocation)
		if (seenDestinations.has(key)) {
			throw new GridTransferError(`Two buttons cannot be placed at ${key}`)
		}
		seenDestinations.add(key)
	}

	if (operation === 'swap') {
		const seenSources = new Set<string>()
		for (const { fromLocation } of realPairs) {
			const key = formatLocation(fromLocation)
			if (seenSources.has(key)) {
				throw new GridTransferError(`${key} cannot be swapped twice`)
			}
			seenSources.add(key)
		}
	}

	/** What is at each location we are about to touch, read before anything moves */
	const occupantBefore = new Map<string, string | null>()
	const rememberOccupant = (location: ControlLocation) => {
		const key = formatLocation(location)
		if (!occupantBefore.has(key)) occupantBefore.set(key, getControlIdAt(location))
	}
	for (const { fromLocation, toLocation } of realPairs) {
		rememberOccupant(fromLocation)
		rememberOccupant(toLocation)
	}

	const placementByKey = new Map<string, GridPlacement>()

	for (const { fromLocation, toLocation } of realPairs) {
		const fromControlId = occupantBefore.get(formatLocation(fromLocation)) ?? null

		switch (operation) {
			case 'copy':
				// An empty source clears its destination, so the gaps in a region survive the copy
				placementByKey.set(
					formatLocation(toLocation),
					fromControlId
						? { location: toLocation, kind: 'clone', sourceControlId: fromControlId }
						: { location: toLocation, kind: 'empty' }
				)
				break

			case 'move':
				placementByKey.set(
					formatLocation(toLocation),
					fromControlId
						? { location: toLocation, kind: 'existing', controlId: fromControlId }
						: { location: toLocation, kind: 'empty' }
				)
				break

			case 'swap': {
				const toControlId = occupantBefore.get(formatLocation(toLocation)) ?? null

				placementByKey.set(
					formatLocation(toLocation),
					fromControlId
						? { location: toLocation, kind: 'existing', controlId: fromControlId }
						: { location: toLocation, kind: 'empty' }
				)
				placementByKey.set(
					formatLocation(fromLocation),
					toControlId
						? { location: fromLocation, kind: 'existing', controlId: toControlId }
						: { location: fromLocation, kind: 'empty' }
				)
				break
			}
		}
	}

	// A moved-from location that nothing is being placed into is left empty
	if (operation === 'move') {
		for (const { fromLocation } of realPairs) {
			const key = formatLocation(fromLocation)
			if (!placementByKey.has(key)) placementByKey.set(key, { location: fromLocation, kind: 'empty' })
		}
	}

	const placements = [...placementByKey.values()]

	// Anything that was in the affected area and has not been given a new home is being overwritten
	const survivingControlIds = new Set(
		placements.flatMap((placement) => (placement.kind === 'existing' ? [placement.controlId] : []))
	)
	const discardedControlIds: string[] = []
	for (const [key, controlId] of occupantBefore) {
		if (!controlId) continue
		if (survivingControlIds.has(controlId)) continue
		// Untouched by this plan - it keeps its place
		if (!placementByKey.has(key)) continue

		discardedControlIds.push(controlId)
	}

	return { placements, discardedControlIds }
}
