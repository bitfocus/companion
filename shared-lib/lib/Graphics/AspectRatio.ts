/**
 * The shape of something, as the smallest whole number ratio which describes it. Two things with the same ratio
 * are the same shape however many pixels each is made of.
 */
export interface AspectRatio {
	w: number
	h: number
}

function greatestCommonDivisor(a: number, b: number): number {
	while (b) {
		;[a, b] = [b, a % b]
	}
	return a
}

/**
 * Reduce a pixel size to the smallest whole number ratio which describes it, so that a 248x58 info bar is
 * recognised as 124:29 rather than being treated as a shape of its own, and so that 72x72 and 120x120 are
 * recognised as the same shape.
 *
 * Returns null for anything which does not describe a shape.
 */
export function reduceAspectRatio(w: number, h: number): AspectRatio | null {
	if (!isFinite(w) || !isFinite(h) || w <= 0 || h <= 0) return null

	const width = Math.round(w)
	const height = Math.round(h)

	const divisor = greatestCommonDivisor(width, height)
	if (!divisor) return null

	return { w: width / divisor, h: height / divisor }
}

/** The same ratio in the "w:h" form the button editor's ratio field uses */
export function formatAspectRatioString(aspectRatio: AspectRatio): string {
	return `${aspectRatio.w}:${aspectRatio.h}`
}

/** Whether two ratios describe the same shape. Both must already be reduced. */
export function aspectRatiosEqual(a: AspectRatio, b: AspectRatio): boolean {
	return a.w === b.w && a.h === b.h
}
