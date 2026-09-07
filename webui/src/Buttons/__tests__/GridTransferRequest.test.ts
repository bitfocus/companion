import { describe, expect, it } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import type { GridTransferPair } from '../GridTools/types.js'
import { planGridTransferRequest, type GridTransferSurroundings } from '../GridTransferRequest.js'

const GRID_SIZE: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

function at(row: number, column: number, pageNumber = 1): ControlLocation {
	return { pageNumber, row, column }
}

function pair(from: ControlLocation, to: ControlLocation): GridTransferPair {
	return { fromLocation: from, toLocation: to }
}

/** A grid holding buttons at these locations, and nowhere else */
function grid(...occupied: ControlLocation[]): GridTransferSurroundings {
	const keys = new Set(occupied.map(formatLocation))

	return {
		isOccupied: (location) => keys.has(formatLocation(location)),
		fitsOnGrid: (locations) =>
			locations.every(
				(location) =>
					location.row >= GRID_SIZE.minRow &&
					location.row <= GRID_SIZE.maxRow &&
					location.column >= GRID_SIZE.minColumn &&
					location.column <= GRID_SIZE.maxColumn
			),
	}
}

describe('planGridTransferRequest', () => {
	describe('with nothing to carry', () => {
		it('reports nothing when every source is empty', () => {
			const request = planGridTransferRequest('copy', [pair(at(0, 0), at(2, 0))], grid(at(2, 0)))

			expect(request.outcome).toBe('nothing')
		})

		it('carries a swap with an empty source, which is how a button is moved into an empty cell', () => {
			const request = planGridTransferRequest('swap', [pair(at(0, 0), at(2, 0))], grid(at(2, 0)))

			expect(request.outcome).toBe('ready')
		})
	})

	describe('landing off the grid', () => {
		it('refuses the whole thing rather than the part that fits', () => {
			const sources = [at(0, 0), at(0, 1)]
			const request = planGridTransferRequest(
				'move',
				[pair(sources[0], at(0, 7)), pair(sources[1], at(0, 8))],
				grid(...sources)
			)

			expect(request).toEqual({
				outcome: 'off-grid',
				pairs: [pair(at(0, 0), at(0, 7)), pair(at(0, 1), at(0, 8))],
				offGrid: [pair(at(0, 1), at(0, 8))],
			})
		})

		it('counts only the buttons being carried, so the gaps are not reported as lost', () => {
			// 0/1 is a gap: it sets where 0/2 lands and has nothing of its own to place
			const request = planGridTransferRequest(
				'copy',
				[pair(at(0, 0), at(0, 6)), pair(at(0, 1), at(0, 7)), pair(at(0, 2), at(0, 8))],
				grid(at(0, 0), at(0, 2))
			)

			expect(request.outcome).toBe('off-grid')
			if (request.outcome !== 'off-grid') return
			expect(request.pairs).toHaveLength(2)
			expect(request.offGrid).toEqual([pair(at(0, 2), at(0, 8))])
		})
	})

	describe('replacing what is already there', () => {
		it('asks about the buttons a copy would replace', () => {
			const request = planGridTransferRequest('copy', [pair(at(0, 0), at(2, 0))], grid(at(0, 0), at(2, 0)))

			expect(request.outcome).toBe('overwrites')
			if (request.outcome !== 'overwrites') return
			expect(request.overwritten).toEqual([pair(at(0, 0), at(2, 0))])
		})

		it('does not count a cell the region is vacating anyway', () => {
			// Nudging a pair one column right: the second lands where the first was
			const sources = [at(0, 0), at(0, 1)]
			const request = planGridTransferRequest(
				'move',
				[pair(sources[0], at(0, 1)), pair(sources[1], at(0, 2))],
				grid(...sources)
			)

			expect(request.outcome).toBe('ready')
		})

		it('counts a cell a copy is landing on even when it is also a source, since a copy vacates nothing', () => {
			const sources = [at(0, 0), at(0, 1)]
			const request = planGridTransferRequest(
				'copy',
				[pair(sources[0], at(0, 1)), pair(sources[1], at(0, 2))],
				grid(...sources)
			)

			expect(request.outcome).toBe('overwrites')
			if (request.outcome !== 'overwrites') return
			expect(request.overwritten).toEqual([pair(at(0, 0), at(0, 1))])
		})

		it('never asks about a swap, which trades rather than destroys', () => {
			const request = planGridTransferRequest('swap', [pair(at(0, 0), at(2, 0))], grid(at(0, 0), at(2, 0)))

			expect(request.outcome).toBe('ready')
		})

		it('does not count the cell under a gap, which is left alone', () => {
			const request = planGridTransferRequest(
				'copy',
				[pair(at(0, 0), at(2, 0)), pair(at(0, 1), at(2, 1))],
				// 0/1 is a gap, and 2/1 is a button it passes over
				grid(at(0, 0), at(2, 1))
			)

			expect(request.outcome).toBe('ready')
		})
	})

	it('is ready when it carries something, fits, and lands on nothing', () => {
		const request = planGridTransferRequest('move', [pair(at(0, 0), at(2, 0))], grid(at(0, 0)))

		expect(request).toEqual({ outcome: 'ready', pairs: [pair(at(0, 0), at(2, 0))] })
	})
})
