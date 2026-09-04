/**
 * Fixed resolution (px) previews are drawn at when nothing asks for a particular size.
 * Matches the effective resolution the previously deprecated drawDataUrl path produced (72px logical at 4x
 * oversampling).
 */
export const PREVIEW_RENDER_SIZE = 288

/** The pixel size a button preview should be drawn at */
export interface PreviewRenderSize {
	width: number
	height: number
}

/** How buttons have always been drawn, and what anything with no reason to ask for a shape wants */
export const DEFAULT_PREVIEW_RENDER_SIZE: PreviewRenderSize = {
	width: PREVIEW_RENDER_SIZE,
	height: PREVIEW_RENDER_SIZE,
}

/**
 * The range a preview size may name. The floor keeps a malformed request from asking for something unusable, and
 * the ceiling keeps one render from being far more expensive than every other - real surface bitmaps are well
 * inside it.
 */
export const PREVIEW_RENDER_SIZE_MIN = 8
export const PREVIEW_RENDER_SIZE_MAX = 2048

/** Identity of a size, for keying the caches and subscriptions which are shared between watchers of one shape */
export function formatPreviewRenderSize(size: PreviewRenderSize): string {
	return `${size.width}x${size.height}`
}

/** Keep a size inside the range the renderer will accept */
export function clampPreviewRenderSize(size: PreviewRenderSize): PreviewRenderSize {
	return {
		width: clampPreviewDimension(size.width),
		height: clampPreviewDimension(size.height),
	}
}

function clampPreviewDimension(value: number): number {
	return Math.min(PREVIEW_RENDER_SIZE_MAX, Math.max(PREVIEW_RENDER_SIZE_MIN, Math.round(value)))
}
