import type * as imageRs from '@julusian/image-rs'
import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'

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

export class ImageResult {
	/**
	 * Image data-url for webui clients
	 */
	readonly #dataUrl: string

	/**
	 * Image draw style
	 */
	readonly style: ImageResultProcessedStyle | null

	readonly #drawNativeCache = new Map<string, Promise<Uint8Array>>()
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

	constructor(
		dataUrl: string,
		style: ImageResultProcessedStyle | null,
		drawNative: ImageResultNativeDrawFn,
		drawElements: readonly SomeButtonGraphicsDrawElement[] | null = null,
		referencedLocations: ReadonlySet<string> = new Set()
	) {
		this.#dataUrl = dataUrl
		this.style = style
		this.#drawNative = drawNative
		this.drawElements = drawElements
		this.referencedLocations = referencedLocations

		this.updated = Date.now()
	}

	/**
	 * Get the image as a data url which can be used by a web base client
	 */
	get asDataUrl(): string {
		return this.#dataUrl
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
}
