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
	/** Absolute rect in the canvas's backing-pixel space */
	rect: PixelRect
	/** Top-level elements are the only ones the drag/resize overlay can edit */
	isTopLevel: boolean
}

function toRect(bounds: DrawBounds): PixelRect {
	return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
}

// Mirrors GraphicsLayeredButtonRenderer.#drawGroupElement: a group with squareCoords gives its children a
// centered square coordinate space rather than the full group rect.
function groupChildBounds(bounds: DrawBounds, squareCoords: boolean): DrawBounds {
	if (!squareCoords) return bounds

	const size = Math.min(bounds.width, bounds.height)
	return new DrawBounds(bounds.x + (bounds.width - size) / 2, bounds.y + (bounds.height - size) / 2, size, size)
}

/**
 * Flatten the resolved draw elements into absolute pixel rects, in draw order (bottom-most first).
 *
 * Draw elements carry bounds already resolved to 0-1 fractions of their parent, so this works for
 * expression-driven elements too. Rotation is intentionally ignored - rects are axis-aligned, which is
 * accurate enough for picking and for drawing a selection outline.
 */
export function buildElementRects(
	elements: readonly SomeButtonGraphicsDrawElement[],
	contentBoundsPx: PixelRect,
	hiddenElements: ReadonlySet<string>,
	selectableIds: ReadonlySet<string>
): ElementRect[] {
	const out: ElementRect[] = []

	const walk = (list: readonly SomeButtonGraphicsDrawElement[], parentBounds: DrawBounds, isTopLevel: boolean) => {
		for (const element of list) {
			// The canvas is the background - it fills the button, so treating it as a hit target would swallow
			// every click on empty space.
			if (element.type === 'canvas') continue
			if (!element.enabled || hiddenElements.has(element.id)) continue

			const selectable = selectableIds.has(element.id)

			if (element.type === 'line') {
				const fromX = parentBounds.x + element.fromX * parentBounds.width
				const toX = parentBounds.x + element.toX * parentBounds.width
				const fromY = parentBounds.y + element.fromY * parentBounds.height
				const toY = parentBounds.y + element.toY * parentBounds.height

				if (selectable) {
					out.push({
						id: element.id,
						rect: {
							x: Math.min(fromX, toX),
							y: Math.min(fromY, toY),
							width: Math.abs(toX - fromX),
							height: Math.abs(toY - fromY),
						},
						isTopLevel,
					})
				}
				continue
			}

			const bounds = parentBounds.compose(element.x, element.y, element.width, element.height)
			if (selectable) out.push({ id: element.id, rect: toRect(bounds), isTopLevel })

			// Children are pushed after their parent so a reverse scan finds the child first.
			//
			// Only descend when the children are elements the user can actually select. Composite elements are
			// emitted as groups too, but their children are internal and carry generated ids that don't exist
			// in the edited model - clicking one must select the composite as a whole. The same test keeps us
			// out of reference children, which come from another button entirely.
			if (element.type === 'group' && element.children.some((child) => selectableIds.has(child.id))) {
				walk(element.children, groupChildBounds(bounds, element.squareCoords), false)
			}
		}
	}

	walk(
		elements,
		new DrawBounds(contentBoundsPx.x, contentBoundsPx.y, contentBoundsPx.width, contentBoundsPx.height),
		true
	)

	return out
}

/** Find the top-most element containing the point, or null when the point is over empty space. */
export function hitTestElements(rects: readonly ElementRect[], x: number, y: number): ElementRect | null {
	for (let i = rects.length - 1; i >= 0; i--) {
		const { rect } = rects[i]
		if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) return rects[i]
	}
	return null
}

export function findElementRect(rects: readonly ElementRect[], id: string): ElementRect | undefined {
	return rects.find((entry) => entry.id === id)
}
