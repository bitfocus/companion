import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type {
	ResolvedSurfaceControl,
	ResolvedSurfaceView,
	SurfaceControlShape,
	SurfaceRect,
} from '@companion-app/shared/SurfaceLayout.js'

/** How large an ordinary control is drawn at 100%, matching a cell of the infinite grid */
const BASE_CONTROL_SIZE = 72

/** A box on the canvas, in the pixels a pointer event carries */
export interface CanvasBox {
	left: number
	top: number
	width: number
	height: number
}

/**
 * How many canvas pixels one of the surface's own pixels is drawn as.
 *
 * Tied to the smallest control on the surface rather than to the surface as a whole, so that zoom means the same
 * thing here as it does on the grid - a key comes out about the size a grid cell would be - however large or small
 * the whole device happens to be. The face's units are arbitrary, not pixels, so this is what gives them a size.
 */
export function surfaceUnitScale(view: ResolvedSurfaceView, drawScale: number): number {
	const sides = view.controls.map((control) => Math.max(control.bounds.width, control.bounds.height))
	const reference = sides.length > 0 ? Math.min(...sides) : BASE_CONTROL_SIZE
	if (!(reference > 0)) return drawScale

	return (BASE_CONTROL_SIZE * drawScale) / reference
}

/** The CSS border-radius which draws a control's shape: a circle, or the layout's rounded corners */
export function controlBorderRadius(shape: SurfaceControlShape, box: CanvasBox): string {
	if (shape.type === 'circle') return '50%'

	return `${Math.min(box.width, box.height) * shape.cornerRadiusRatio}px`
}

/** Where a control is drawn on the canvas */
export function controlCanvasBox(control: ResolvedSurfaceControl, unitScale: number): CanvasBox {
	return {
		left: control.bounds.x * unitScale,
		top: control.bounds.y * unitScale,
		width: control.bounds.width * unitScale,
		height: control.bounds.height * unitScale,
	}
}

/**
 * How small a control may be, in canvas pixels, before it is given more room to be clicked than it is drawn with.
 * About a fingertip, and comfortably more than a mouse needs.
 */
const MIN_HIT_SIZE = 32

/** A control as it is put on the canvas: where it is drawn, and the area which picks it */
export interface PlacedSurfaceControl {
	control: ResolvedSurfaceControl
	/** Where the control is drawn */
	box: CanvasBox
	/** What picks it - the drawn box, grown around a control too thin to hit easily. Never overlaps another's. */
	hit: CanvasBox
}

interface Edges {
	left: number
	top: number
	right: number
	bottom: number
}

/**
 * Put every control of a surface onto the canvas.
 *
 * A control thinner than a fingertip (a touch strip, a row of leds) is given a hit area grown to `MIN_HIT_SIZE`
 * around it. Where two of those would collide, both are cut back to the middle of the gap between the controls
 * themselves, so on a dense face each keeps its own half of the space between them and none reaches into what
 * another draws. Controls which deliberately overlap are left alone; the later one wins there, as it is drawn on top.
 */
export function placeSurfaceControls(view: ResolvedSurfaceView, unitScale: number): PlacedSurfaceControl[] {
	const boxes = view.controls.map((control) => controlCanvasBox(control, unitScale))
	const drawn = boxes.map(toEdges)
	const grown = drawn.map((edges) => growToMinimum(edges, MIN_HIT_SIZE))
	const hits = grown.map((edges) => ({ ...edges }))

	for (let a = 0; a < drawn.length; a++) {
		for (let b = a + 1; b < drawn.length; b++) {
			if (!edgesOverlap(grown[a], grown[b])) continue

			const split = splitBetween(drawn[a], drawn[b])
			if (!split) continue // The controls themselves overlap, so there is no gap to share out

			clipToSide(hits[a], split.axis, split.at, split.aIsBefore)
			clipToSide(hits[b], split.axis, split.at, !split.aIsBefore)
		}
	}

	// Kept on the canvas, so an edge control does not grow scrollbars
	const limit: Edges = { left: 0, top: 0, right: view.extent.width * unitScale, bottom: view.extent.height * unitScale }

	return view.controls.map((control, index) => ({
		control,
		box: boxes[index],
		hit: fromEdges(clampEdges(hits[index], drawn[index], limit)),
	}))
}

function toEdges(box: CanvasBox): Edges {
	return { left: box.left, top: box.top, right: box.left + box.width, bottom: box.top + box.height }
}

function fromEdges(edges: Edges): CanvasBox {
	return { left: edges.left, top: edges.top, width: edges.right - edges.left, height: edges.bottom - edges.top }
}

function growToMinimum(edges: Edges, minimum: number): Edges {
	const growX = Math.max(0, minimum - (edges.right - edges.left)) / 2
	const growY = Math.max(0, minimum - (edges.bottom - edges.top)) / 2

	return { left: edges.left - growX, top: edges.top - growY, right: edges.right + growX, bottom: edges.bottom + growY }
}

function edgesOverlap(a: Edges, b: Edges): boolean {
	return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}

/**
 * Where to divide the space between two controls: along whichever axis they are furthest apart on, at the middle of
 * the gap. Null when they overlap, as there is no gap.
 */
function splitBetween(a: Edges, b: Edges): { axis: 'x' | 'y'; at: number; aIsBefore: boolean } | null {
	const gapX = Math.max(b.left - a.right, a.left - b.right)
	const gapY = Math.max(b.top - a.bottom, a.top - b.bottom)
	if (gapX < 0 && gapY < 0) return null

	if (gapX >= gapY) {
		const aIsBefore = a.right <= b.left
		return { axis: 'x', at: aIsBefore ? (a.right + b.left) / 2 : (b.right + a.left) / 2, aIsBefore }
	} else {
		const aIsBefore = a.bottom <= b.top
		return { axis: 'y', at: aIsBefore ? (a.bottom + b.top) / 2 : (b.bottom + a.top) / 2, aIsBefore }
	}
}

function clipToSide(edges: Edges, axis: 'x' | 'y', at: number, keepBefore: boolean): void {
	if (axis === 'x') {
		if (keepBefore) edges.right = Math.min(edges.right, at)
		else edges.left = Math.max(edges.left, at)
	} else {
		if (keepBefore) edges.bottom = Math.min(edges.bottom, at)
		else edges.top = Math.max(edges.top, at)
	}
}

/** Keep a hit area inside the limit, but never smaller than what the control draws */
function clampEdges(edges: Edges, drawn: Edges, limit: Edges): Edges {
	return {
		left: Math.min(drawn.left, Math.max(limit.left, edges.left)),
		top: Math.min(drawn.top, Math.max(limit.top, edges.top)),
		right: Math.max(drawn.right, Math.min(limit.right, edges.right)),
		bottom: Math.max(drawn.bottom, Math.min(limit.bottom, edges.bottom)),
	}
}

/**
 * Which control is under a point, or null for the bare face between them.
 *
 * Asks the hit areas rather than what is drawn, so a thin control can be picked from just beside it. Later controls
 * win, so that anything a layout deliberately draws on top of something else is what gets hit.
 */
export function controlAtPoint(
	placed: readonly PlacedSurfaceControl[],
	x: number,
	y: number
): ResolvedSurfaceControl | null {
	for (let index = placed.length - 1; index >= 0; index--) {
		const { control, hit } = placed[index]

		if (x >= hit.left && x < hit.left + hit.width && y >= hit.top && y < hit.top + hit.height) return control
	}

	return null
}

/**
 * Which controls a dragged box touches.
 *
 * Anything the box overlaps at all, rather than only what it encloses: a box dragged across a row of controls is
 * meant to take the row, and on a face where the controls are different sizes there is no "enclosed" to speak of.
 * Measured against what is drawn, as that is what the box is being dragged across.
 */
export function controlsInBox(placed: readonly PlacedSurfaceControl[], box: CanvasBox): ResolvedSurfaceControl[] {
	return placed.filter((entry) => overlaps(entry.box, box)).map((entry) => entry.control)
}

function overlaps(a: CanvasBox, b: CanvasBox): boolean {
	return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top
}

/** The button a control drives, on the page being shown */
export function controlLocation(control: ResolvedSurfaceControl, pageNumber: number): ControlLocation {
	return { pageNumber, row: control.cell.row, column: control.cell.column }
}

/**
 * Where the focus goes when it is stepped in a direction.
 *
 * Geometric rather than by row and column, because the controls of a surface are not in rows and columns - they
 * are wherever the device puts them. The nearest control whose centre lies in the direction asked for wins, which
 * on a device whose controls do line up is the neighbour, and on one where they do not is still the one a person
 * would point at.
 */
export function stepToNearestControl(
	view: ResolvedSurfaceView,
	from: ResolvedSurfaceControl,
	rowDelta: number,
	columnDelta: number
): ResolvedSurfaceControl | null {
	const origin = centreOf(from.bounds)

	let best: { control: ResolvedSurfaceControl; distance: number } | null = null

	for (const control of view.controls) {
		if (control === from) continue

		const centre = centreOf(control.bounds)
		const along = (centre.x - origin.x) * columnDelta + (centre.y - origin.y) * rowDelta
		if (along <= 0) continue // Behind, or square beside, the direction asked for

		// How far off the line of travel it is, weighted so that something almost straight ahead beats something
		// closer but well off to one side
		const across = Math.abs((centre.x - origin.x) * rowDelta) + Math.abs((centre.y - origin.y) * columnDelta)
		const distance = along + across * 2

		if (!best || distance < best.distance) best = { control, distance }
	}

	return best?.control ?? null
}

function centreOf(bounds: SurfaceRect): { x: number; y: number } {
	return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }
}
