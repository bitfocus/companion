import type { DrawStyleButtonModel } from '@companion-app/shared/Model/StyleModel.js'

export type ImageResultStyle = DrawStyleButtonModel | 'pagenum' | 'pageup' | 'pagedown'

export class ImageResult {
	/**
	 * Image data-url for webui clients
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

	/**
	 * Last updated time
	 */
	readonly updated: number

	constructor(buffer: Buffer, width: number, height: number, dataUrl: string, style: ImageResultStyle | undefined) {
		this.buffer = buffer
		this.bufferWidth = width
		this.bufferHeight = height
		this.#dataUrl = dataUrl
		this.style = style

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
			return this.style.bgcolor ?? 0
		} else {
			return 0
		}
	}
}
