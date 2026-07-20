import type { ElementRect, PixelRect } from './elementHitTest.js'

/** How close (in canvas backing pixels) an edge must be to a target before it snaps */
export const SNAP_THRESHOLD_PX = 5

export interface SnapResult {
	/** Correction to add to the moving edges, in fraction-of-content space */
	delta: number
	/** The target that was snapped to, in fraction-of-content space, for drawing a guide */
	line: number
}

/**
 * Collect snap targets for one axis, in fraction-of-content space: the content edges and centre, plus the
 * leading/centre/trailing edges of every other top-level element.
 */
export function collectSnapTargets(
	rects: readonly ElementRect[],
	contentBoundsPx: PixelRect,
	excludeId: string,
	axis: 'x' | 'y'
): number[] {
	const origin = axis === 'x' ? contentBoundsPx.x : contentBoundsPx.y
	const extent = axis === 'x' ? contentBoundsPx.width : contentBoundsPx.height
	if (extent <= 0) return [0, 0.5, 1]

	const targets = [0, 0.5, 1]

	for (const entry of rects) {
		if (!entry.isTopLevel || entry.id === excludeId) continue

		const start = ((axis === 'x' ? entry.rect.x : entry.rect.y) - origin) / extent
		const size = (axis === 'x' ? entry.rect.width : entry.rect.height) / extent
		targets.push(start, start + size / 2, start + size)
	}

	return targets
}

/**
 * Find the smallest correction that brings any one of `candidates` onto a target within the threshold.
 * Candidates and targets are both in fraction-of-content space.
 */
export function snapAxis(
	candidates: readonly number[],
	targets: readonly number[],
	thresholdFraction: number
): SnapResult | null {
	let best: SnapResult | null = null

	for (const candidate of candidates) {
		for (const target of targets) {
			const delta = target - candidate
			if (Math.abs(delta) > thresholdFraction) continue
			if (!best || Math.abs(delta) < Math.abs(best.delta)) best = { delta, line: target }
		}
	}

	return best
}

/** Convert the pixel snap threshold into a fraction of the content bounds on one axis. */
export function thresholdFractionFor(contentExtentPx: number): number {
	return contentExtentPx > 0 ? SNAP_THRESHOLD_PX / contentExtentPx : 0
}
