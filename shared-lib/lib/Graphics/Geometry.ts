import type { DrawBounds } from './Util.js'

/**
 * A rotation transform to reapply when drawing the selection marker, so the marker follows the
 * orientation the element was drawn at. `pivot` is the DrawBounds whose center the rotation is
 * about (matching `usingRotation`).
 */
export interface MarkerRotation {
	pivot: DrawBounds
	angle: number
}

/**
 * An element's bounds plus the rotation transforms applied to it (outermost first), used to draw the
 * selection marker lines in the element's rotated frame.
 */
export interface SelectedElementMarker {
	bounds: DrawBounds
	rotations: MarkerRotation[]
}

/** One drawn element's resolved geometry, as emitted by the renderer. */
export interface ElementGeometry extends SelectedElementMarker {
	id: string
}

/** A line segment as its two endpoints: [x1, y1, x2, y2] */
export type MarkerLine = [number, number, number, number]

/**
 * Extend a parent's rotation chain with a rotation about `pivot`'s center. A zero angle adds nothing.
 * Rotations stay ordered outermost-first.
 */
export function appendRotation(parent: MarkerRotation[], pivot: DrawBounds, angle: number): MarkerRotation[] {
	return angle ? [...parent, { pivot, angle }] : parent
}

/**
 * Rotate a point about each pivot centre. Rotations are outermost-first, applied innermost-first to
 * match how the nested canvas transforms compose.
 */
export function rotatePointThroughRotations(
	rotations: readonly PlacedRotation[],
	x: number,
	y: number
): [number, number] {
	for (let i = rotations.length - 1; i >= 0; i--) {
		;[x, y] = rotateAbout(rotations[i], x, y, 1)
	}
	return [x, y]
}

/** The exact inverse of {@link rotatePointThroughRotations}: outermost-first, with negated angles. */
export function inverseRotatePointThroughRotations(
	rotations: readonly MarkerRotation[],
	x: number,
	y: number
): [number, number] {
	for (let i = 0; i < rotations.length; i++) {
		;[x, y] = rotateAbout(rotations[i], x, y, -1)
	}
	return [x, y]
}

function rotateAbout({ pivot, angle }: PlacedRotation, x: number, y: number, sign: 1 | -1): [number, number] {
	if (!angle) return [x, y]

	const cx = pivot.x + pivot.width / 2
	const cy = pivot.y + pivot.height / 2
	const rad = (sign * angle * Math.PI) / 180
	const cos = Math.cos(rad)
	const sin = Math.sin(rad)
	const dx = x - cx
	const dy = y - cy

	return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
}

/** A rectangle, as plain data */
export interface PlacedRect {
	x: number
	y: number
	width: number
	height: number
}

/** A rotation about the centre of `pivot`, as plain data */
export interface PlacedRotation {
	pivot: PlacedRect
	angle: number
}

/** An element's bounds and the rotations applied to it (outermost first), as plain data */
export interface PlacedElement {
	bounds: PlacedRect
	rotations: readonly PlacedRotation[]
}

/** A 2d affine transform, in the order of `CanvasRenderingContext2D.setTransform`: x' = ax + cy + e, y' = bx + dy + f */
export type AffineTransform = [a: number, b: number, c: number, d: number, e: number, f: number]

/** The transform mapping the unit square onto an element as placed, ie its own coordinate space onto the canvas */
function placedElementTransform({ bounds, rotations }: PlacedElement): AffineTransform {
	const [ox, oy] = rotatePointThroughRotations(rotations, bounds.x, bounds.y)
	const [xx, xy] = rotatePointThroughRotations(rotations, bounds.x + bounds.width, bounds.y)
	const [yx, yy] = rotatePointThroughRotations(rotations, bounds.x, bounds.y + bounds.height)
	return [xx - ox, xy - oy, yx - ox, yy - oy, ox, oy]
}

/**
 * The transform that moves something drawn for an element placed at `from` to where the element is placed at `to`
 * @returns The transform, or null if `from` has no area so can't be mapped from
 */
export function transformBetweenPlacements(from: PlacedElement, to: PlacedElement): AffineTransform | null {
	const [a, b, c, d, e, f] = placedElementTransform(from)
	const det = a * d - b * c
	if (!det) return null

	// The inverse of `from`, then `to`
	const inverse: AffineTransform = [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
	return multiplyTransforms(placedElementTransform(to), inverse)
}

/** Compose two transforms, applying `second` first and then `first` */
function multiplyTransforms(first: AffineTransform, second: AffineTransform): AffineTransform {
	const [a1, b1, c1, d1, e1, f1] = first
	const [a2, b2, c2, d2, e2, f2] = second
	return [
		a1 * a2 + c1 * b2,
		b1 * a2 + d1 * b2,
		a1 * c2 + c1 * d2,
		b1 * c2 + d1 * d2,
		a1 * e2 + c1 * f2 + e1,
		b1 * e2 + d1 * f2 + f1,
	]
}

/** An element's rotated frame expressed as a single rotation of its box about its own centre */
export interface MarkerTransform {
	centerX: number
	centerY: number
	width: number
	height: number
	/** Net rotation in degrees */
	angle: number
}

/**
 * Collapse a marker's rotation chain into a single rotation about the element's own centre.
 *
 * Every transform in the chain is a pure rotation about a point, so the element stays a rigid,
 * unscaled rectangle: a `width` x `height` box centred on the rotated centre and rotated by the summed
 * angle is exact at any nesting depth. That makes it directly expressible as a CSS transform.
 */
export function resolveMarkerTransform(marker: SelectedElementMarker): MarkerTransform {
	const { bounds, rotations } = marker

	const [centerX, centerY] = rotatePointThroughRotations(
		rotations,
		bounds.x + bounds.width / 2,
		bounds.y + bounds.height / 2
	)

	let angle = 0
	for (const rotation of rotations) angle += rotation.angle

	return { centerX, centerY, width: bounds.width, height: bounds.height, angle }
}

/**
 * Clip the infinite line through (px, py) with direction (dx, dy) to the rectangle [0, w] x [0, h].
 * Returns the two endpoints [x1, y1, x2, y2], or null if the line misses the rectangle.
 */
export function clipLineToRect(
	px: number,
	py: number,
	dx: number,
	dy: number,
	w: number,
	h: number
): MarkerLine | null {
	let tMin = -Infinity
	let tMax = Infinity

	// Intersect the line with each axis' slab: [0, max] along that axis
	for (const [p, d, max] of [
		[px, dx, w],
		[py, dy, h],
	] as const) {
		if (d === 0) {
			// Parallel to this slab: only valid if the point already lies within it
			if (p < 0 || p > max) return null
		} else {
			let t0 = (0 - p) / d
			let t1 = (max - p) / d
			if (t0 > t1) [t0, t1] = [t1, t0]
			tMin = Math.max(tMin, t0)
			tMax = Math.min(tMax, t1)
		}
	}

	if (tMin > tMax) return null
	return [px + tMin * dx, py + tMin * dy, px + tMax * dx, py + tMax * dy]
}

/**
 * Compute the selection marker lines for `marker` within a `width` x `height` image.
 *
 * Each of the element's four bounds edges becomes a line that follows the element's rotation and is
 * extended across the whole image (intentionally overshooting to be very visible). Each edge is a
 * midpoint + direction: the midpoint is rotated about each pivot centre, while the direction simply
 * gains the sum of the rotation angles (pivots only translate the midpoint, not the direction). The
 * resulting infinite line is clipped to the image to find its endpoints. Edges that miss are omitted.
 */
export function computeSelectionMarkerLines(
	marker: SelectedElementMarker,
	width: number,
	height: number,
	outset: number
): MarkerLine[] {
	const { bounds, rotations } = marker

	const centerX = bounds.x + bounds.width / 2
	const centerY = bounds.y + bounds.height / 2

	// Net rotation of every edge's direction (pivots only translate the midpoint, not the direction)
	let totalAngle = 0
	for (const { angle } of rotations) totalAngle += angle

	// The four edges, each as a midpoint on the edge plus its unrotated direction in degrees. `outset`
	// pushes each edge outward (away from the centre) so the line sits just outside the element instead
	// of straddling its edge.
	const edges: Array<{ x: number; y: number; direction: number }> = [
		{ x: centerX, y: bounds.y - outset, direction: 0 },
		{ x: centerX, y: bounds.maxY + outset, direction: 0 },
		{ x: bounds.x - outset, y: centerY, direction: 90 },
		{ x: bounds.maxX + outset, y: centerY, direction: 90 },
	]

	const lines: MarkerLine[] = []
	for (const edge of edges) {
		const [mx, my] = rotatePointThroughRotations(rotations, edge.x, edge.y)
		const rad = ((edge.direction + totalAngle) * Math.PI) / 180
		const ends = clipLineToRect(mx, my, Math.cos(rad), Math.sin(rad), width, height)
		if (ends) lines.push(ends)
	}
	return lines
}
