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
 * The selected element's bounds plus the rotation transforms applied to it (outermost first), used
 * to draw the selection marker lines in the element's rotated frame.
 */
export interface SelectedElementMarker {
	bounds: DrawBounds
	rotations: MarkerRotation[]
}

/** A line segment as its two endpoints: [x1, y1, x2, y2] */
export type MarkerLine = [number, number, number, number]

/**
 * Build a selection marker for `bounds`, wrapping any `inner` rotations with an outer rotation about
 * `pivot`'s center. A zero angle adds nothing. Rotations stay ordered outermost-first.
 */
export function buildSelectionMarker(
	bounds: DrawBounds,
	pivot: DrawBounds,
	angle: number,
	inner: MarkerRotation[] = []
): SelectedElementMarker {
	return {
		bounds,
		rotations: angle ? [{ pivot, angle }, ...inner] : inner,
	}
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
	height: number
): MarkerLine[] {
	const { bounds, rotations } = marker

	const centerX = bounds.x + bounds.width / 2
	const centerY = bounds.y + bounds.height / 2

	// Net rotation of every edge's direction (pivots only translate the midpoint, not the direction)
	let totalAngle = 0
	for (const { angle } of rotations) totalAngle += angle

	// Rotate a point about each pivot centre. Rotations are outermost-first, applied innermost-first
	// to match how the nested canvas transforms compose.
	const rotatePoint = (x: number, y: number): [number, number] => {
		for (let i = rotations.length - 1; i >= 0; i--) {
			const { pivot, angle } = rotations[i]
			if (!angle) continue
			const cx = pivot.x + pivot.width / 2
			const cy = pivot.y + pivot.height / 2
			const rad = (angle * Math.PI) / 180
			const cos = Math.cos(rad)
			const sin = Math.sin(rad)
			const dx = x - cx
			const dy = y - cy
			x = cx + dx * cos - dy * sin
			y = cy + dx * sin + dy * cos
		}
		return [x, y]
	}

	// The four edges, each as a midpoint on the edge plus its unrotated direction in degrees
	const edges: Array<{ x: number; y: number; direction: number }> = [
		{ x: centerX, y: bounds.y, direction: 0 },
		{ x: centerX, y: bounds.maxY, direction: 0 },
		{ x: bounds.x, y: centerY, direction: 90 },
		{ x: bounds.maxX, y: centerY, direction: 90 },
	]

	const lines: MarkerLine[] = []
	for (const edge of edges) {
		const [mx, my] = rotatePoint(edge.x, edge.y)
		const rad = ((edge.direction + totalAngle) * Math.PI) / 180
		const ends = clipLineToRect(mx, my, Math.cos(rad), Math.sin(rad), width, height)
		if (ends) lines.push(ends)
	}
	return lines
}
