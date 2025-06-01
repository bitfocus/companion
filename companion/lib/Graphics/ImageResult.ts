import type { DrawStyleButtonModel, DrawStyleLayeredButtonModel } from '@companion-app/shared/Model/StyleModel.js'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type imageRs from '@julusian/image-rs'

export type ImageResultStyle = DrawStyleButtonModel | DrawStyleLayeredButtonModel | 'pagenum' | 'pageup' | 'pagedown'

export type ImageResultNativeDrawFn = (
	width: number,
	height: number,
	rotation: SurfaceRotation | null,
	format: imageRs.PixelFormat
) => Promise<Buffer>

export class ImageResult {
	/**
	 * Image data-url for socket.io clients
	 */
	readonly #dataUrl: string

	/**
	 * Image pixel buffer
	 */
	readonly buffer: Buffer

	/**
	 * Image pixel buffer width
	 */
	readonly bufferWidth: number

	/**
	 * Image pixel buffer height
	 */
	readonly bufferHeight: number

	/**
	 * Image draw style
	 */
	readonly style: ImageResultStyle | undefined

	// TODO-layered calls to this should be cached, so that we don't keep re-drawing the same image
	readonly drawNative: ImageResultNativeDrawFn

	/**
	 * Last updated time
	 */
	readonly updated: number

	constructor(
		buffer: Buffer,
		width: number,
		height: number,
		dataUrl: string,
		style: ImageResultStyle | undefined,
		drawNative: ImageResultNativeDrawFn
	) {
		this.buffer = buffer
		this.bufferWidth = width
		this.bufferHeight = height
		this.#dataUrl = dataUrl
		this.style = style
		this.drawNative = drawNative

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
}
