/**
 * Mangled surfaceIds for button-reference forwarding. A reference forwards to its target with its own control id
 * appended to the surfaceId, isolating the target's per-surface press/hold state per reference. Surface resolution
 * strips the suffix again (see {@link stripReferenceSurfaceId}) so `self` actions hit the real originating surface.
 */

/** Separator between the real surfaceId and an appended control id. `#` appears in no surface/control id, so it
 * can't collide, and it stays display/JSON-safe. */
const SEP = '#ref#'

/** How many reference hops a forwarded press may take before it is treated as a loop and dropped. */
export const MAX_REFERENCE_DEPTH = 8

/** Append a reference control id to a surfaceId. Returns `undefined` unchanged (a legitimate no-surface press). */
export function mangleReferenceSurfaceId(
	surfaceId: string | undefined,
	referenceControlId: string
): string | undefined {
	if (surfaceId === undefined) return undefined
	return `${surfaceId}${SEP}${referenceControlId}`
}

/** Recover the real surfaceId by dropping any appended reference control id(s). A no-op on unmangled ids. */
export function stripReferenceSurfaceId(surfaceId: string): string {
	const index = surfaceId.indexOf(SEP)
	return index === -1 ? surfaceId : surfaceId.slice(0, index)
}

/** The number of reference hops encoded in a surfaceId (0 for an unmangled id). */
export function referenceSurfaceIdDepth(surfaceId: string | undefined): number {
	if (!surfaceId) return 0
	let count = 0
	let index = surfaceId.indexOf(SEP)
	while (index !== -1) {
		count++
		index = surfaceId.indexOf(SEP, index + SEP.length)
	}
	return count
}
