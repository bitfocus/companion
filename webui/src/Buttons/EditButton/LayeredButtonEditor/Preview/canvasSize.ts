/** Padding the preview canvas leaves around the button drawing area, per side */
export const PAD_X = 10
export const PAD_Y = 10

/** Used until the container has been measured, and as a floor so the canvas never collapses */
const MIN_CANVAS_SIZE = 80
/** Keeps the button a sensible size on a very large panel */
const MAX_CANVAS_SIZE = 360

/** Parse "w:h" into a width/height ratio, falling back to square for anything malformed */
export function parseAspectRatio(aspectRatio: string): number {
	const [w, h] = aspectRatio.split(':').map(Number)
	if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return 1
	return w / h
}

/**
 * Largest button drawing area of the given aspect ratio that fits the container, allowing for the padding
 * the canvas adds around it.
 *
 * This is done in JS rather than CSS because the canvas wrapper has to shrink-wrap the canvas exactly - the
 * selection overlay positions itself as a percentage of that box - which leaves the canvas's own
 * `max-height: 100%` resolving against an auto-height parent, so it would never scale down.
 */
export function fitCanvasSize(
	aspectRatio: string,
	containerWidth: number,
	containerHeight: number
): { width: number; height: number } {
	const ratio = parseAspectRatio(aspectRatio)

	const availableWidth = containerWidth - PAD_X * 2
	const availableHeight = containerHeight - PAD_Y * 2

	// Before the first measurement there's nothing to fit to, so start from the floor
	if (availableWidth <= 0 || availableHeight <= 0) {
		return ratio >= 1
			? { width: MIN_CANVAS_SIZE * ratio, height: MIN_CANVAS_SIZE }
			: { width: MIN_CANVAS_SIZE, height: MIN_CANVAS_SIZE / ratio }
	}

	// Fit to whichever axis runs out first
	let width = availableWidth
	let height = width / ratio
	if (height > availableHeight) {
		height = availableHeight
		width = height * ratio
	}

	const scale = Math.min(1, MAX_CANVAS_SIZE / Math.max(width, height))
	return {
		width: Math.max(MIN_CANVAS_SIZE, Math.floor(width * scale)),
		height: Math.max(MIN_CANVAS_SIZE, Math.floor(height * scale)),
	}
}
