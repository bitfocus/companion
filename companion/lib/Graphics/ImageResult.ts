import type { DrawStyleButtonModel, DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type imageRs from '@julusian/image-rs'

export type ImageResultStyle = DrawStyleButtonModel | DrawStyleLayeredButtonModel | 'pagenum' | 'pageup' | 'pagedown'

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
	readonly style: ImageResultStyle | undefined

	readonly #drawNativeCache = new Map<string, Promise<Uint8Array>>()
	readonly #drawNative: ImageResultNativeDrawFn

	/**
	 * Last updated time
	 */
	readonly updated: number

	constructor(dataUrl: string, style: ImageResultStyle | undefined, drawNative: ImageResultNativeDrawFn) {
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
		if (typeof this.style === 'object') {
			if (this.style.style === 'button') {
				return this.style.bgcolor ?? 0
				// TODO-layered reimplement this
				// } else if (this.style.style === 'button-layered') {
				// 	return this.style.elements[0].type === 'canvas' ? this.style.elements[0].color : 0
			} else {
				return 0
			}
		} else {
			return 0
		}
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
