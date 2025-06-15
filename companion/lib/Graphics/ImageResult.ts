import type { HorizontalAlignment, VerticalAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type imageRs from '@julusian/image-rs'

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

		/** @deprecated */
		cloud: boolean
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
	 * Image data-url for socket.io clients
	 */
	readonly #dataUrl: string

	/**
	 * Image draw style
	 */
	readonly style: ImageResultProcessedStyle

	readonly #drawNativeCache = new Map<string, Promise<Uint8Array>>()
	readonly #drawNative: ImageResultNativeDrawFn

	/**
	 * Last updated time
	 */
	readonly updated: number

	constructor(dataUrl: string, style: ImageResultProcessedStyle, drawNative: ImageResultNativeDrawFn) {
		this.#dataUrl = dataUrl
		this.style = style
		this.#drawNative = drawNative

		this.updated = Date.now()
	}

	/**
	 * Get the image as a data url which can be used by a web base client
	 */
	get asDataUrl(): string {
		return this.#dataUrl
	}

	get bgcolor(): number {
		return this.style.color?.color ?? 0
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
