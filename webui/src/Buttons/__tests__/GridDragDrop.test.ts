import { describe, expect, it } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import { planGridDrop } from '../GridDragDrop.js'

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

function at(row: number, column: number, pageNumber = 1): ControlLocation {
	return { pageNumber, row, column }
}

const nothingOccupied = () => false
function occupiedAt(...locations: ControlLocation[]) {
	const keys = new Set(locations.map(formatLocation))
	return (location: ControlLocation) => keys.has(formatLocation(location))
}

describe('planGridDrop', () => {
	it('moves a single button to where it was dropped', () => {
		const plan = planGridDrop(at(1, 1), at(2, 3), [at(1, 1)], GRID_SIZE, nothingOccupied)

		expect(plan).toEqual({
			operation: 'move',
			pairs: [{ fromLocation: at(1, 1), toLocation: at(2, 3) }],
			overwrittenLocations: [],
			fitsOnGrid: true,
		})
	})

	it('does nothing when dropped back where it started', () => {
		expect(planGridDrop(at(1, 1), at(1, 1), [at(1, 1)], GRID_SIZE, nothingOccupied)).toBeNull()
	})

	it('swaps when one button lands on another', () => {
		const plan = planGridDrop(at(1, 1), at(2, 3), [at(1, 1)], GRID_SIZE, occupiedAt(at(2, 3)))

		expect(plan?.operation).toBe('swap')
	})

	it('keeps a region in shape, with the dragged cell under the cursor', () => {
		// Dragging the bottom-right of a 2x2 block: the rest follows at its own offset
		const sources = [at(1, 1), at(1, 2), at(2, 1), at(2, 2)]
		const plan = planGridDrop(at(2, 2), at(3, 5), sources, GRID_SIZE, nothingOccupied)

		expect(plan?.pairs).toEqual([
			{ fromLocation: at(1, 1), toLocation: at(2, 4) },
			{ fromLocation: at(1, 2), toLocation: at(2, 5) },
			{ fromLocation: at(2, 1), toLocation: at(3, 4) },
			{ fromLocation: at(2, 2), toLocation: at(3, 5) },
		])
	})

	it('reports a drop that would hang off the grid, rather than vanishing', () => {
		// Still described, so the cells can be shown as a refused landing spot while it is being held
		const sources = [at(1, 6), at(1, 7)]
		const plan = planGridDrop(at(1, 6), at(1, 7), sources, GRID_SIZE, nothingOccupied)

		expect(plan?.fitsOnGrid).toBe(false)
		expect(plan?.pairs).toHaveLength(2)
	})

	it('will not drop only the buttons that fit', () => {
		const sources = [at(0, 0), at(1, 0), at(2, 0), at(3, 0)]

		expect(planGridDrop(at(0, 0), at(1, 0), sources, GRID_SIZE, nothingOccupied)?.fitsOnGrid).toBe(false)
	})

	it('fits when the whole region lands on the grid', () => {
		expect(planGridDrop(at(1, 1), at(2, 3), [at(1, 1)], GRID_SIZE, nothingOccupied)?.fitsOnGrid).toBe(true)
	})

	it('reports what would be overwritten', () => {
		const sources = [at(0, 0), at(0, 1)]
		const plan = planGridDrop(at(0, 0), at(2, 0), sources, GRID_SIZE, occupiedAt(at(2, 0), at(2, 1)))

		expect(plan?.operation).toBe('move')
		expect(plan?.overwrittenLocations).toEqual([at(2, 0), at(2, 1)])
	})

	it('does not count a cell the region is vacating as overwritten', () => {
		// Nudging a pair one column right: the second lands where the first was
		const sources = [at(0, 0), at(0, 1)]
		const plan = planGridDrop(at(0, 0), at(0, 1), sources, GRID_SIZE, occupiedAt(at(0, 0), at(0, 1)))

		expect(plan?.overwrittenLocations).toEqual([])
	})

	it('never swaps a whole region, since the displaced buttons have nowhere sensible to go', () => {
		const sources = [at(0, 0), at(0, 1)]
		const plan = planGridDrop(at(0, 0), at(2, 0), sources, GRID_SIZE, occupiedAt(at(2, 0)))

		expect(plan?.operation).toBe('move')
	})

	it('drops onto another page', () => {
		const plan = planGridDrop(at(1, 1, 1), at(1, 1, 4), [at(1, 1, 1)], GRID_SIZE, nothingOccupied)

		expect(plan?.pairs).toEqual([{ fromLocation: at(1, 1, 1), toLocation: at(1, 1, 4) }])
	})
})
