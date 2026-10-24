import type { DisplayedSize } from '../Graphics/DisplayedLocations.js'
import { LINK_BITMAP_MAX_EDGE } from './Protocol/v1/Schemas.js'

const LINK_BITMAP_MIN_EDGE = 8

/** How far apart the shapes of two sizes are, as the log of the ratio of their aspect ratios: 0 for the same shape */
export function shapeDistance(a: DisplayedSize, b: DisplayedSize): number {
	return Math.abs(Math.log((a.width / a.height) * (b.height / b.width)))
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
 * The bitmap sizes to ask a peer for, to draw a button at all these sizes: each size itself, so that it is drawn at its
 * own resolution rather than scaled from another. Only one too large for the protocol is asked for smaller
 */
export function linkBitmapSizesFor(sizes: Iterable<DisplayedSize>): DisplayedSize[] {
	const bitmaps = new Map<string, DisplayedSize>()
	for (const size of sizes) {
		if (!isUsableSize(size)) continue
		const bitmap = scaleToBounds(size)
		bitmaps.set(`${bitmap.width}x${bitmap.height}`, bitmap)
	}
	return Array.from(bitmaps.values())
}

function isUsableSize(size: DisplayedSize): boolean {
	return Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0
}

function scaleToBounds(size: DisplayedSize): DisplayedSize {
	const scale = Math.min(1, LINK_BITMAP_MAX_EDGE / Math.max(size.width, size.height))

	const clamp = (value: number) => Math.min(LINK_BITMAP_MAX_EDGE, Math.max(LINK_BITMAP_MIN_EDGE, Math.round(value)))
	return { width: clamp(size.width * scale), height: clamp(size.height * scale) }
}
