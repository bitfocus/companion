import {
	inverseRotatePointThroughRotations,
	type ElementGeometry,
	type MarkerRotation,
} from '@companion-app/shared/Graphics/Geometry.js'
import { DrawBounds } from '@companion-app/shared/Graphics/Util.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'

export interface PixelRect {
	x: number
	y: number
	width: number
	height: number
}

export interface ElementRect {
	id: string
	/** Unrotated rect in the canvas's backing-pixel space */
	rect: DrawBounds
	/** Rotations applied to `rect`, outermost first */
	rotations: MarkerRotation[]
	/** Top-level elements are the only ones the drag/resize overlay can edit */
	isTopLevel: boolean
}

/** Minimum clickable thickness given to a line's bounding box, in canvas backing pixels */
const LINE_HIT_THICKNESS_PX = 8

/** Net rotation of an element in degrees, 0 when it sits in an unrotated frame. */
export function netRotation(rotations: readonly MarkerRotation[]): number {
	let total = 0
	for (const rotation of rotations) total += rotation.angle
	return total
}

/**
 * Narrow the renderer's geometry down to the elements the editor lets the user pick, in draw order
 * (bottom-most first, parents before their children).
 *
 * The geometry itself - bounds composition, group coordinate spaces, rotation - comes from the renderer
 * so it can't drift from what was actually drawn. This only applies the editor's own policy about what
 * is selectable.
 */
export function filterElementRects(
	geometry: readonly ElementGeometry[],
	elements: readonly SomeButtonGraphicsDrawElement[],
	hiddenElements: ReadonlySet<string>,
	selectableIds: ReadonlySet<string>
): ElementRect[] {
	const topLevelIds = new Set(elements.map((element) => element.id))
	const byId = new Map<string, SomeButtonGraphicsDrawElement>()
	const index = (list: readonly SomeButtonGraphicsDrawElement[]) => {
		for (const element of list) {
			byId.set(element.id, element)
			if (element.type === 'group' || element.type === 'reference') index(element.children)
		}
	}
	index(elements)

	const out: ElementRect[] = []

	for (const entry of geometry) {
		const element = byId.get(entry.id)
		if (!element) continue

		// The canvas is the background - it fills the button, so treating it as a hit target would swallow
		// every click on empty space.
		if (element.type === 'canvas') continue
		if (!element.enabled || hiddenElements.has(element.id)) continue

		// Composite elements are emitted as groups, but their children are internal and carry generated ids
		// that don't exist in the edited model - clicking one must select the composite as a whole. The same
		// test keeps us out of reference children, which come from another button entirely.
		if (!selectableIds.has(element.id)) continue

		let rect = entry.bounds

		if (element.type === 'line') {
			// The renderer only pads a line's bounds out to its stroke thickness, which is all but impossible
			// to click on a thin line, so give every line rect a minimum grabbable thickness.
			const padX = Math.max(0, (LINE_HIT_THICKNESS_PX - rect.width) / 2)
			const padY = Math.max(0, (LINE_HIT_THICKNESS_PX - rect.height) / 2)
			rect = new DrawBounds(rect.x - padX, rect.y - padY, rect.width + padX * 2, rect.height + padY * 2)
		}

		out.push({ id: element.id, rect, rotations: entry.rotations, isTopLevel: topLevelIds.has(element.id) })
	}

	return out
}

/** Find the top-most element containing the point, or null when the point is over empty space. */
export function hitTestElements(rects: readonly ElementRect[], x: number, y: number): ElementRect | null {
	for (let i = rects.length - 1; i >= 0; i--) {
		const entry = rects[i]
		const { rect } = entry

		// Undo the element's rotations to test the point in the frame the rect is expressed in
		const [localX, localY] = inverseRotatePointThroughRotations(entry.rotations, x, y)

		if (localX >= rect.x && localX <= rect.x + rect.width && localY >= rect.y && localY <= rect.y + rect.height) {
			return entry
		}
	}
	return null
}

export function findElementRect(rects: readonly ElementRect[], id: string): ElementRect | undefined {
	return rects.find((entry) => entry.id === id)
}
