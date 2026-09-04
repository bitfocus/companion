import { describe, expect, it } from 'vitest'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'
import {
	drawnCellRange,
	fitInsideBox,
	gridTileGeometry,
	locationAtCanvasPoint,
	revealScrollOffset,
	SQUARE_TILE_ASPECT_RATIO,
} from '../GridCanvasGeometry.js'

const GRID: UserConfigGridSize = { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 }

/** Cells are square unless a surface says otherwise, so most of these say nothing about the shape */
const square = (drawScale: number) => gridTileGeometry(drawScale, SQUARE_TILE_ASPECT_RATIO)

/** The 2:1 of a Stream Deck + touch strip segment */
const STRIP = { w: 2, h: 1 }

describe('gridTileGeometry', () => {
	it('scales the button with the zoom level', () => {
		expect(square(1).inner).toEqual({ width: 72, height: 72 })
		expect(square(2).inner).toEqual({ width: 144, height: 144 })
	})

	it('stops the gap growing once it is wide enough, so zooming in grows the buttons', () => {
		expect(square(1).padding).toBeCloseTo(3.6)
		expect(square(2).padding).toBe(6)
		expect(square(4).padding).toBe(6)
	})

	it('measures a cell as the button plus the gap on both sides', () => {
		const { inner, padding, size } = square(2)

		expect(size).toEqual({ width: inner.width + padding * 2, height: inner.height + padding * 2 })
	})

	it('fits a wide cell into the box a square one would have had, rather than growing it', () => {
		// Otherwise viewing as a surface with wide buttons would show half as many per screen
		expect(gridTileGeometry(1, STRIP).inner).toEqual({ width: 72, height: 36 })
	})

	it('fits a tall cell the same way', () => {
		expect(gridTileGeometry(1, { w: 1, h: 2 }).inner).toEqual({ width: 36, height: 72 })
	})
})

describe('fitInsideBox', () => {
	it('fills the width of a box with a wider shape, and centres nothing it cannot fill', () => {
		expect(fitInsideBox({ width: 72, height: 72 }, STRIP)).toEqual({ width: 72, height: 36 })
	})

	it('fills the height of a box with a taller shape', () => {
		expect(fitInsideBox({ width: 72, height: 72 }, { w: 1, h: 3 })).toEqual({ width: 24, height: 72 })
	})

	it('leaves a shape which already matches the box alone', () => {
		expect(fitInsideBox({ width: 72, height: 36 }, STRIP)).toEqual({ width: 72, height: 36 })
	})
})

describe('locationAtCanvasPoint', () => {
	it('answers with the cell the point is inside', () => {
		expect(locationAtCanvasPoint({ x: 0, y: 0 }, GRID, { width: 80, height: 80 }, 4)).toEqual({
			pageNumber: 4,
			row: 0,
			column: 0,
		})
		expect(locationAtCanvasPoint({ x: 199, y: 81 }, GRID, { width: 80, height: 80 }, 4)).toEqual({
			pageNumber: 4,
			row: 1,
			column: 2,
		})
	})

	it('measures from the first cell, which is not always 0/0', () => {
		const offset: UserConfigGridSize = { minRow: -2, maxRow: 2, minColumn: -3, maxColumn: 3 }

		expect(locationAtCanvasPoint({ x: 0, y: 0 }, offset, { width: 80, height: 80 }, 1)).toEqual({
			pageNumber: 1,
			row: -2,
			column: -3,
		})
		expect(locationAtCanvasPoint({ x: 240, y: 160 }, offset, { width: 80, height: 80 }, 1)).toEqual({
			pageNumber: 1,
			row: 0,
			column: 0,
		})
	})

	it('holds at the edge rather than naming a cell that does not exist', () => {
		// Dragging a box past the corner of the grid keeps picking the corner
		expect(locationAtCanvasPoint({ x: 9999, y: 9999 }, GRID, { width: 80, height: 80 }, 1)).toEqual({
			pageNumber: 1,
			row: 3,
			column: 7,
		})
		expect(locationAtCanvasPoint({ x: -50, y: -50 }, GRID, { width: 80, height: 80 }, 1)).toEqual({
			pageNumber: 1,
			row: 0,
			column: 0,
		})
	})
})

describe('revealScrollOffset', () => {
	// A viewport 200 wide, showing cells 80 wide
	const reveal = (scroll: number, cellStart: number) => revealScrollOffset(scroll, 200, cellStart, 80)

	it('leaves the grid alone when the cell is already in view', () => {
		expect(reveal(0, 0)).toBe(0)
		expect(reveal(0, 120)).toBe(0)
		expect(reveal(100, 160)).toBe(100)
	})

	it('scrolls back just far enough to show a cell above or left of the viewport', () => {
		expect(reveal(200, 80)).toBe(80)
	})

	it('scrolls forward just far enough to show a cell below or right of it', () => {
		// The cell ends at 320, so the viewport has to start at 120
		expect(reveal(0, 240)).toBe(120)
	})

	it('shows the start of a cell too big to fit, rather than its end', () => {
		expect(revealScrollOffset(0, 50, 240, 80)).toBe(270)
		expect(revealScrollOffset(270, 50, 240, 80)).toBe(240)
	})
})

describe('drawnCellRange', () => {
	it('draws half a screenful either side of what is visible', () => {
		// 4 cells fit, so 2 more each way
		expect(drawnCellRange(0, 100, 800, 320, 80)).toEqual({ first: 8, last: 16 })
	})

	it('never draws past the ends of the grid', () => {
		// Ten cells fit in the viewport, so the spill would reach past both ends of an 8-column grid
		expect(drawnCellRange(0, 7, 0, 800, 80)).toEqual({ first: 0, last: 7 })
	})

	it('measures from the first cell, which is not always 0', () => {
		// Two cells fit, so the spill reaches one either side of columns -3 and -2
		expect(drawnCellRange(-3, 3, 0, 160, 80)).toEqual({ first: -3, last: 0 })
	})

	it('draws the one cell when there is no room to show anything', () => {
		expect(drawnCellRange(0, 7, 0, 0, 80)).toEqual({ first: 0, last: 0 })
	})
})
