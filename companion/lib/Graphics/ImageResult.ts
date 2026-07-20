import * as imageRs from '@julusian/image-rs'
import type { LedGaugeDescription } from '@companion-app/shared/Graphics/GaugeLeds.js'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'

/**
 * Fixed resolution (px) used when rendering preview data urls for web/emulator/cloud/import consumers.
 * Matches the effective resolution the previously deprecated drawDataUrl path produced (72px logical at 4x oversampling).
 */
export const PREVIEW_RENDER_SIZE = 288

export interface ImageResultProcessedStyle {
	type: 'button' | 'pagenum' | 'pageup' | 'pagedown'
	color?: { color: number }
	text?: {
		text: string
		color: number
		size: number | 'auto'
		halign: HorizontalAlignment
		valign: VerticalAlignment
	}
	png64?: {
		dataUrl: string
		halign: HorizontalAlignment
		valign: VerticalAlignment
	}
	state?: {
		pushed: boolean
		showTopBar: boolean | 'default'
	}
	/**
	 * The gauge element (selected via the `leds` usage) baked for driving a surface's LED strip/ring.
	 */
	leds?: LedGaugeDescription
}

export type ImageResultNativeDrawFn = (
	width: number,
	height: number,
	rotation: SurfaceRotation | null,
	format: imageRs.PixelFormat
) => Promise<Uint8Array>

/**
 * Lightweight, always-on counters for the drawing pipeline, exposed for the metrics endpoint.
 * These are cheap to maintain and let a leak in the native (Skia/canvas) render path show up as
 * a climbing `live` count or a `calls` >> `renders` cache-miss ratio.
 */
let liveImageResultCount = 0
let totalImageResultCount = 0
let drawNativeCalls = 0
let drawNativeRenders = 0
let drawNativeEncodedCalls = 0
let drawNativeEncodedRenders = 0

/**
 * Decrement the live count when an ImageResult is garbage collected. This is a passive GC hook -
 * it does not force GC - so `live` reflects how many renders are actually retained in memory.
 */
const imageResultFinalization =
	typeof FinalizationRegistry !== 'undefined'
		? new FinalizationRegistry<void>(() => {
				liveImageResultCount--
			})
		: undefined

/**
 * Optional observer for native render durations (seconds). Only invoked for drawNative cache misses -
 * i.e. actual native renders. Set by the metrics layer to feed a histogram.
 */
let drawNativeRenderObserver: ((durationSeconds: number) => void) | undefined

export function setDrawNativeRenderObserver(observer: ((durationSeconds: number) => void) | undefined): void {
	drawNativeRenderObserver = observer
}

export function getImageResultStats(): {
	live: number
	total: number
	drawNativeCalls: number
	drawNativeRenders: number
	drawNativeEncodedCalls: number
	drawNativeEncodedRenders: number
} {
	return {
		live: liveImageResultCount,
		total: totalImageResultCount,
		drawNativeCalls,
		drawNativeRenders,
		drawNativeEncodedCalls,
		drawNativeEncodedRenders,
	}
}

export class ImageResult {
	/**
	 * Image draw style
	 */
	readonly style: ImageResultProcessedStyle | null

	readonly #drawNativeCache = new Map<string, Promise<Uint8Array>>()
	readonly #drawNativeEncodedCache = new Map<string, Promise<string>>()
	readonly #drawNative: ImageResultNativeDrawFn

	/**
	 * Last updated time
	 */
	readonly updated: number

	/**
	 * The draw elements that produced this render. Only set for layered button controls.
	 * Used by the reference element post-processor to embed another control's elements.
	 */
	readonly drawElements: readonly SomeButtonGraphicsDrawElement[] | null

	/**
	 * The set of location strings (e.g. '1/0/0') transitively referenced by this render.
	 * Used for loop detection when embedding reference elements.
	 */
	readonly referencedLocations: ReadonlySet<string>

	/**
	 * Content identity of this render: two renders with the same non-undefined cacheKey are
	 * byte-identical. `undefined` means the render has no comparable identity.
	 */
	readonly cacheKey: string | undefined

	constructor(
		cacheKey: string | undefined,
		style: ImageResultProcessedStyle | null,
		drawNative: ImageResultNativeDrawFn,
		drawElements: readonly SomeButtonGraphicsDrawElement[] | null = null,
		referencedLocations: ReadonlySet<string> = new Set()
	) {
		this.cacheKey = cacheKey
		this.style = style
		this.#drawNative = drawNative
		this.drawElements = drawElements
		this.referencedLocations = referencedLocations

		this.updated = Date.now()

		liveImageResultCount++
		totalImageResultCount++
		imageResultFinalization?.register(this)
	}

	get bgcolor(): number {
		return this.style?.color?.color ?? 0
	}

	/**
	 * Generate a native sized image buffer for this button render.
	 * Typically this will redraw from the source data, but it may scale and letterbox the image
	 * This caches the result for the same width, height, rotation and format.
	 */
	async drawNative(
		width: number,
		height: number,
		rotation: SurfaceRotation | null,
		format: imageRs.PixelFormat
	): Promise<Uint8Array> {
		drawNativeCalls++
		const cacheKey = `${width}x${height}-${rotation ?? ''}-${format}`
		const cached = this.#drawNativeCache.get(cacheKey)
		if (cached) return cached

		drawNativeRenders++
		const newBuffer = this.#drawNative(width, height, rotation, format)
		if (drawNativeRenderObserver) {
			const renderStart = performance.now()
			// Observe on a separate chain so we don't interfere with (or double-handle errors on) the cached
			// promise. Render failures are ignored for timing purposes.
			newBuffer.then(
				() => drawNativeRenderObserver?.((performance.now() - renderStart) / 1000),
				() => undefined
			)
		}
		this.#drawNativeCache.set(cacheKey, newBuffer)
		return newBuffer
	}

	/**
	 * Generate a native sized image encoded as a compressed image data url (e.g. png or webp).
	 * Renders the raw rgb pixels (reusing the drawNative cache) then encodes once, caching the
	 * data url for the same width, height, rotation and image format.
	 *
	 * The result is a data url (`data:image/png;base64,...`) so the base64 encoding is done once,
	 * natively, rather than materialising an encoded buffer just to base64 it again before sending.
	 * png and webp are both encoded losslessly, so the image is pixel-identical to the rgb buffer.
	 * Returns an empty string when there is nothing to render.
	 */
	async drawNativeEncoded(
		width: number,
		height: number,
		rotation: SurfaceRotation | null,
		format: imageRs.ImageFormat
	): Promise<string> {
		drawNativeEncodedCalls++
		const cacheKey = `${width}x${height}-${rotation ?? ''}-${format}`
		const cached = this.#drawNativeEncodedCache.get(cacheKey)
		if (cached) return cached

		drawNativeEncodedRenders++
		const newDataUrl = (async () => {
			const raw = await this.drawNative(width, height, rotation, 'rgb')
			if (raw.length === 0) return ''

			return imageRs.ImageTransformer.fromBuffer(raw, width, height, 'rgb').toDataUrl(format)
		})()
		this.#drawNativeEncodedCache.set(cacheKey, newDataUrl)
		return newDataUrl
	}
}
