import { describe, expect, it } from 'vitest'
import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { GridTransferError, planGridTransfer, type GridPlacement } from '../../lib/Controls/GridTransfer.js'

function at(row: number, column: number, pageNumber = 1): ControlLocation {
	return { pageNumber, row, column }
}

/** A grid where the given locations hold a control named after themselves */
function gridWith(...occupied: ControlLocation[]) {
	const ids = new Set(occupied.map(formatLocation))
	return (location: ControlLocation): string | null => {
		const key = formatLocation(location)
		return ids.has(key) ? `control:${key}` : null
	}
}

/** Placements keyed by location, for readable assertions */
function byLocation(placements: GridPlacement[]): Record<string, GridPlacement> {
	return Object.fromEntries(placements.map((p) => [formatLocation(p.location), p]))
}

describe('planGridTransfer', () => {
	describe('copy', () => {
		it('clones the source into the destination, leaving the source alone', () => {
			const plan = planGridTransfer('copy', [{ fromLocation: at(0, 0), toLocation: at(1, 1) }], gridWith(at(0, 0)))

			expect(plan.placements).toEqual([{ location: at(1, 1), kind: 'clone', sourceControlId: 'control:1/0/0' }])
			expect(plan.discardedControlIds).toEqual([])
		})

		it('discards whatever was already at the destination', () => {
			const plan = planGridTransfer(
				'copy',
				[{ fromLocation: at(0, 0), toLocation: at(1, 1) }],
				gridWith(at(0, 0), at(1, 1))
			)

			expect(plan.discardedControlIds).toEqual(['control:1/1/1'])
		})

		it('leaves the destination of a gap alone, rather than clearing it', () => {
			// A 2x1 region where only the first cell is occupied, copied over two existing buttons
			const plan = planGridTransfer(
				'copy',
				[
					{ fromLocation: at(0, 0), toLocation: at(2, 0) },
					{ fromLocation: at(0, 1), toLocation: at(2, 1) },
				],
				gridWith(at(0, 0), at(2, 0), at(2, 1))
			)

			const placements = byLocation(plan.placements)
			expect(placements['1/2/0']).toEqual({ location: at(2, 0), kind: 'clone', sourceControlId: 'control:1/0/0' })
			// The gap set where the first button landed and then had nothing of its own to place, so the
			// button it passed over keeps its place
			expect(placements['1/2/1']).toBeUndefined()
			expect(plan.discardedControlIds).toEqual(['control:1/2/0'])
		})

		it('does nothing at all when every source is empty', () => {
			const plan = planGridTransfer('copy', [{ fromLocation: at(0, 0), toLocation: at(2, 0) }], gridWith(at(2, 0)))

			expect(plan.placements).toEqual([])
			expect(plan.discardedControlIds).toEqual([])
		})

		it('reads a source that is also a destination as it was at the start', () => {
			// A -> B and B -> C: C must get the *original* B, not the copy of A landing there
			const plan = planGridTransfer(
				'copy',
				[
					{ fromLocation: at(0, 0), toLocation: at(0, 1) },
					{ fromLocation: at(0, 1), toLocation: at(0, 2) },
				],
				gridWith(at(0, 0), at(0, 1))
			)

			const placements = byLocation(plan.placements)
			expect(placements['1/0/1']).toEqual({ location: at(0, 1), kind: 'clone', sourceControlId: 'control:1/0/0' })
			expect(placements['1/0/2']).toEqual({ location: at(0, 2), kind: 'clone', sourceControlId: 'control:1/0/1' })
		})

		it('copies between pages', () => {
			const plan = planGridTransfer(
				'copy',
				[{ fromLocation: at(0, 0, 1), toLocation: at(0, 0, 4) }],
				gridWith(at(0, 0, 1))
			)

			expect(plan.placements).toEqual([{ location: at(0, 0, 4), kind: 'clone', sourceControlId: 'control:1/0/0' }])
		})
	})

	describe('move', () => {
		it('moves the control and empties where it came from', () => {
			const plan = planGridTransfer('move', [{ fromLocation: at(0, 0), toLocation: at(1, 1) }], gridWith(at(0, 0)))

			const placements = byLocation(plan.placements)
			expect(placements['1/1/1']).toEqual({ location: at(1, 1), kind: 'existing', controlId: 'control:1/0/0' })
			expect(placements['1/0/0']).toEqual({ location: at(0, 0), kind: 'empty' })
			expect(plan.discardedControlIds).toEqual([])
		})

		it('nudging a row one column across does not eat itself', () => {
			// The classic overlap: every source is also the previous cell's destination
			const plan = planGridTransfer(
				'move',
				[
					{ fromLocation: at(0, 0), toLocation: at(0, 1) },
					{ fromLocation: at(0, 1), toLocation: at(0, 2) },
					{ fromLocation: at(0, 2), toLocation: at(0, 3) },
				],
				gridWith(at(0, 0), at(0, 1), at(0, 2))
			)

			const placements = byLocation(plan.placements)
			expect(placements['1/0/1']).toEqual({ location: at(0, 1), kind: 'existing', controlId: 'control:1/0/0' })
			expect(placements['1/0/2']).toEqual({ location: at(0, 2), kind: 'existing', controlId: 'control:1/0/1' })
			expect(placements['1/0/3']).toEqual({ location: at(0, 3), kind: 'existing', controlId: 'control:1/0/2' })
			expect(placements['1/0/0']).toEqual({ location: at(0, 0), kind: 'empty' })

			// Nothing was overwritten - every control found a new home
			expect(plan.discardedControlIds).toEqual([])
		})

		it('discards a control that is overwritten and not itself moving', () => {
			const plan = planGridTransfer(
				'move',
				[{ fromLocation: at(0, 0), toLocation: at(1, 1) }],
				gridWith(at(0, 0), at(1, 1))
			)

			expect(plan.discardedControlIds).toEqual(['control:1/1/1'])
		})

		it('leaves the destination of a gap alone, rather than clearing it', () => {
			const plan = planGridTransfer(
				'move',
				[
					{ fromLocation: at(0, 0), toLocation: at(2, 0) },
					{ fromLocation: at(0, 1), toLocation: at(2, 1) },
				],
				gridWith(at(0, 0), at(2, 1))
			)

			const placements = byLocation(plan.placements)
			expect(placements['1/2/0']).toEqual({ location: at(2, 0), kind: 'existing', controlId: 'control:1/0/0' })
			expect(placements['1/2/1']).toBeUndefined()
			// Only the cell the button actually left is vacated
			expect(placements['1/0/0']).toEqual({ location: at(0, 0), kind: 'empty' })
			expect(placements['1/0/1']).toBeUndefined()
			expect(plan.discardedControlIds).toEqual([])
		})
	})

	describe('swap', () => {
		it('exchanges two controls', () => {
			const plan = planGridTransfer(
				'swap',
				[{ fromLocation: at(0, 0), toLocation: at(1, 1) }],
				gridWith(at(0, 0), at(1, 1))
			)

			const placements = byLocation(plan.placements)
			expect(placements['1/1/1']).toEqual({ location: at(1, 1), kind: 'existing', controlId: 'control:1/0/0' })
			expect(placements['1/0/0']).toEqual({ location: at(0, 0), kind: 'existing', controlId: 'control:1/1/1' })
			expect(plan.discardedControlIds).toEqual([])
		})

		it('swaps against an empty slot without losing anything', () => {
			const plan = planGridTransfer('swap', [{ fromLocation: at(0, 0), toLocation: at(1, 1) }], gridWith(at(0, 0)))

			const placements = byLocation(plan.placements)
			expect(placements['1/1/1']).toEqual({ location: at(1, 1), kind: 'existing', controlId: 'control:1/0/0' })
			expect(placements['1/0/0']).toEqual({ location: at(0, 0), kind: 'empty' })
			expect(plan.discardedControlIds).toEqual([])
		})

		it('rejects swapping the same button twice', () => {
			expect(() =>
				planGridTransfer(
					'swap',
					[
						{ fromLocation: at(0, 0), toLocation: at(1, 1) },
						{ fromLocation: at(0, 0), toLocation: at(2, 2) },
					],
					gridWith(at(0, 0))
				)
			).toThrow(GridTransferError)
		})
	})

	describe('validation', () => {
		it('rejects two buttons landing on the same cell', () => {
			expect(() =>
				planGridTransfer(
					'copy',
					[
						{ fromLocation: at(0, 0), toLocation: at(1, 1) },
						{ fromLocation: at(0, 1), toLocation: at(1, 1) },
					],
					gridWith(at(0, 0), at(0, 1))
				)
			).toThrow(GridTransferError)
		})

		it('ignores a pair that goes nowhere', () => {
			const plan = planGridTransfer('move', [{ fromLocation: at(0, 0), toLocation: at(0, 0) }], gridWith(at(0, 0)))

			expect(plan.placements).toEqual([])
			expect(plan.discardedControlIds).toEqual([])
		})

		it('does not treat a no-op pair as a duplicate destination', () => {
			const plan = planGridTransfer(
				'move',
				[
					{ fromLocation: at(0, 0), toLocation: at(0, 0) },
					{ fromLocation: at(0, 1), toLocation: at(0, 0) },
				],
				gridWith(at(0, 0), at(0, 1))
			)

			const placements = byLocation(plan.placements)
			expect(placements['1/0/0']).toEqual({ location: at(0, 0), kind: 'existing', controlId: 'control:1/0/1' })
		})
	})
})
