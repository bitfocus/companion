import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { ResolvedSurfaceControl, ResolvedSurfaceView, SurfaceRect } from '@companion-app/shared/SurfaceLayout.js'

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
 * the whole device happens to be.
 */
export function surfaceUnitScale(view: ResolvedSurfaceView, drawScale: number): number {
	const sides = view.controls.map((control) => Math.max(control.bounds.width, control.bounds.height))
	const reference = sides.length > 0 ? Math.min(...sides) : BASE_CONTROL_SIZE
	if (!(reference > 0)) return drawScale

	return (BASE_CONTROL_SIZE * drawScale) / reference
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
 * Which control is under a point, or null for the bare face between them.
 *
 * Later controls win, so that anything a layout deliberately draws on top of something else is what gets hit.
 */
export function controlAtPoint(
	view: ResolvedSurfaceView,
	unitScale: number,
	x: number,
	y: number
): ResolvedSurfaceControl | null {
	for (let index = view.controls.length - 1; index >= 0; index--) {
		const control = view.controls[index]
		const box = controlCanvasBox(control, unitScale)

		if (x >= box.left && x < box.left + box.width && y >= box.top && y < box.top + box.height) return control
	}

	return null
}

/**
 * Which controls a dragged box touches.
 *
 * Anything the box overlaps at all, rather than only what it encloses: a box dragged across a row of controls is
 * meant to take the row, and on a face where the controls are different sizes there is no "enclosed" to speak of.
 */
export function controlsInBox(view: ResolvedSurfaceView, unitScale: number, box: CanvasBox): ResolvedSurfaceControl[] {
	return view.controls.filter((control) => overlaps(controlCanvasBox(control, unitScale), box))
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
