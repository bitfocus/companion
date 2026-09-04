import type { AspectRatio } from '@companion-app/shared/Graphics/AspectRatio.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { UserConfigGridSize } from '@companion-app/shared/Model/UserConfigModel.js'

/** How far a pointer must travel across the grid before it is dragging out a selection */
export const MARQUEE_START_THRESHOLD = 6

/** A point in canvas pixels, measured from the top-left of the whole grid rather than the viewport */
export interface CanvasPoint {
	x: number
	y: number
}

/** A width and a height, of a cell or of the button drawn in it */
export interface GridTileSize {
	width: number
	height: number
}

export interface GridTileGeometry {
	/** The button itself */
	inner: GridTileSize
	/** Drawn around the button, so neighbouring buttons do not touch */
	padding: number
	/** What one cell occupies on the canvas, which is what all the placement maths is in */
	size: GridTileSize
}

/** The shape every cell is drawn at unless a surface says otherwise */
export const SQUARE_TILE_ASPECT_RATIO: AspectRatio = { w: 1, h: 1 }

/** How large a square cell is at 100%, and the box a cell of any other shape is fitted into */
const BASE_TILE_SIZE = 72

/**
 * How big one cell is at this zoom level, and at this shape.
 *
 * A non-square cell is fitted into the box a square one would have occupied rather than keeping its
 * width and growing downwards, so that viewing the grid as a surface with wide buttons shows the same
 * number of them per screen rather than half as many.
 *
 * The padding stops growing once it would be more than a hairline gap, so zooming in makes the
 * buttons bigger rather than the space between them.
 */
export function gridTileGeometry(drawScale: number, aspectRatio: AspectRatio): GridTileGeometry {
	const box = BASE_TILE_SIZE * drawScale
	const inner = fitInsideBox({ width: box, height: box }, aspectRatio)

	const padding = Math.min(6, Math.min(inner.width, inner.height) * 0.05)

	return {
		inner,
		padding,
		size: { width: inner.width + padding * 2, height: inner.height + padding * 2 },
	}
}

/**
 * The largest box of this shape which fits inside another, centred.
 *
 * This is what letterboxes the minority shape of a surface: the touch strip of a Stream Deck + is
 * drawn the full width of its cell and half the height, in the cell every other control also gets,
 * rather than the rows being sized one by one.
 */
export function fitInsideBox(box: GridTileSize, aspectRatio: AspectRatio): GridTileSize {
	if (aspectRatio.w <= 0 || aspectRatio.h <= 0) return box

	const scale = Math.min(box.width / aspectRatio.w, box.height / aspectRatio.h)

	return { width: aspectRatio.w * scale, height: aspectRatio.h * scale }
}

/**
 * Which cell a point on the canvas is in.
 *
 * Clamped to the grid, so a pointer dragged past the edge keeps picking the last row or column
 * rather than falling off into cells that do not exist.
 */
export function locationAtCanvasPoint(
	point: CanvasPoint,
	gridSize: UserConfigGridSize,
	tileSize: GridTileSize,
	pageNumber: number
): ControlLocation {
	return {
		pageNumber,
		column: clamp(gridSize.minColumn + Math.floor(point.x / tileSize.width), gridSize.minColumn, gridSize.maxColumn),
		row: clamp(gridSize.minRow + Math.floor(point.y / tileSize.height), gridSize.minRow, gridSize.maxRow),
	}
}

/**
 * Where to scroll one axis so that a cell is fully in view, moving as little as possible.
 *
 * A cell that is already in view does not move the grid at all - stepping the focus around should
 * only scroll when it has to, or the grid jumps about under a held arrow key.
 */
export function revealScrollOffset(scroll: number, viewport: number, cellStart: number, cellSize: number): number {
	if (cellStart < scroll) return cellStart
	if (cellStart + cellSize > scroll + viewport) return cellStart + cellSize - viewport
	return scroll
}

/**
 * Which cells to put in the DOM for one axis.
 *
 * Half a screenful either side of what is visible, so scrolling has somewhere to go before the next
 * render catches up - but not so much that a large grid is drawn in its entirety.
 */
export function drawnCellRange(
	min: number,
	max: number,
	scroll: number,
	viewport: number,
	tileSize: number
): { first: number; last: number } {
	const visibleCells = viewport / tileSize
	const visibleMin = min + scroll / tileSize
	const visibleMax = visibleMin + visibleCells

	return {
		first: Math.max(Math.floor(visibleMin - visibleCells / 2), min),
		last: Math.min(Math.ceil(visibleMax + visibleCells / 2), max),
	}
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}
