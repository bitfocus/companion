import type { DisplayedSize } from '../Graphics/DisplayedLocations.js'
import { LINK_BITMAP_MAX_EDGE } from './Protocol/v1/Schemas.js'

/**
 * The smallest short edge remote buttons are requested at. Larger than the 72px buttons are designed at, so that they
 * still look sharp when drawn a little larger or oversampled
 */
export const LINK_BITMAP_MIN_SHORT_EDGE = 144

const LINK_BITMAP_MIN_EDGE = 8

/** How far apart the aspect ratios of two sizes can be, as a fraction, to be drawn from the same bitmap */
const SAME_SHAPE_TOLERANCE = 0.03

/** How far apart the shapes of two sizes are, as the log of the ratio of their aspect ratios: 0 for the same shape */
export function shapeDistance(a: DisplayedSize, b: DisplayedSize): number {
	return Math.abs(Math.log((a.width / a.height) * (b.height / b.width)))
}

/** Whether two sizes are close enough in shape to be drawn from the same bitmap */
export function isSameShape(a: DisplayedSize, b: DisplayedSize): boolean {
	return shapeDistance(a, b) <= Math.log(1 + SAME_SHAPE_TOLERANCE)
}

/** Of some sizes, the one closest in shape to a size */
export function closestShape<T extends DisplayedSize>(candidates: Iterable<T>, size: DisplayedSize): T | undefined {
	let best: T | undefined
	let bestDistance = Infinity
	for (const candidate of candidates) {
		const distance = shapeDistance(candidate, size)
		if (distance < bestDistance) {
			best = candidate
			bestDistance = distance
		}
	}
	return best
}

/**
 * The bitmap sizes to ask a peer for, to draw a button at all these sizes: one for each shape, as large as the largest
 * size of that shape, within the bounds of the protocol
 */
export function linkBitmapSizesFor(sizes: Iterable<DisplayedSize>): DisplayedSize[] {
	// Largest first, so that each shape is drawn for its largest size
	const sorted = Array.from(sizes)
		.filter(isUsableSize)
		.sort((a, b) => b.width * b.height - a.width * a.height)

	const shapes: DisplayedSize[] = []
	for (const size of sorted) {
		if (!shapes.some((shape) => isSameShape(shape, size))) shapes.push(size)
	}

	return shapes.map(scaleToBounds)
}

function isUsableSize(size: DisplayedSize): boolean {
	return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0
}

function scaleToBounds(size: DisplayedSize): DisplayedSize {
	let scale = Math.max(1, LINK_BITMAP_MIN_SHORT_EDGE / Math.min(size.width, size.height))
	scale = Math.min(scale, LINK_BITMAP_MAX_EDGE / Math.max(size.width, size.height))

	const clamp = (value: number) => Math.min(LINK_BITMAP_MAX_EDGE, Math.max(LINK_BITMAP_MIN_EDGE, Math.round(value)))
	return { width: clamp(size.width * scale), height: clamp(size.height * scale) }
}
