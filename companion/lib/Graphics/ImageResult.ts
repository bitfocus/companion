import * as imageRs from '@julusian/image-rs'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import { lazy } from '../Resources/Util.js'

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
}

export type ImageResultNativeDrawFn = (
	width: number,
	height: number,
	rotation: SurfaceRotation | null,
	format: imageRs.PixelFormat
) => Promise<Uint8Array>

export type ImageResultDataUrlDrawFn = (
	width: number,
	height: number,
	rotation: SurfaceRotation | null
) => Promise<string>

export class ImageResult {
	/**
	 * Image draw style
	 */
	readonly style: ImageResultProcessedStyle | null

	readonly #drawNativeCache = new Map<string, Promise<Uint8Array>>()
	readonly #drawNativeEncodedCache = new Map<string, Promise<string>>()
	readonly #drawNative: ImageResultNativeDrawFn
	readonly #dataUrl: () => Promise<string>

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

	constructor(
		style: ImageResultProcessedStyle | null,
		drawNative: ImageResultNativeDrawFn,
		drawDataUrl: ImageResultDataUrlDrawFn,
		drawElements: readonly SomeButtonGraphicsDrawElement[] | null = null,
		referencedLocations: ReadonlySet<string> = new Set()
	) {
		this.style = style
		this.#drawNative = drawNative
		this.drawElements = drawElements
		this.#dataUrl = lazy(async () => drawDataUrl(72, 72, null)) // Default values for backwards compatibility
		this.referencedLocations = referencedLocations

		this.updated = Date.now()
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
		const cacheKey = `${width}x${height}-${rotation ?? ''}-${format}`
		const cached = this.#drawNativeCache.get(cacheKey)
		if (cached) return cached

		const newBuffer = this.#drawNative(width, height, rotation, format)
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
		const cacheKey = `${width}x${height}-${rotation ?? ''}-${format}`
		const cached = this.#drawNativeEncodedCache.get(cacheKey)
		if (cached) return cached

		const newDataUrl = (async () => {
			const raw = await this.drawNative(width, height, rotation, 'rgb')
			if (raw.length === 0) return ''

			return imageRs.ImageTransformer.fromBuffer(raw, width, height, 'rgb').toDataUrl(format)
		})()
		this.#drawNativeEncodedCache.set(cacheKey, newDataUrl)
		return newDataUrl
	}

	/**
	 * Get the image as a png data url for web and similar clients
	 * This caches the result between calls, and is safe to call multiple times
	 *
	 * @deprecated This is a second, separate data-url flow alongside {@link drawNativeEncoded}. It
	 * renders oversampled and encodes via the canvas (png only, fixed 72px), whereas drawNativeEncoded
	 * encodes the native render via image-rs (png/webp, any size). These should be unified onto a single
	 * path once oversampling is decoupled from the target size in the worker render fn.
	 */
	async drawDataUrl(): Promise<string> {
		return this.#dataUrl()
	}
}
