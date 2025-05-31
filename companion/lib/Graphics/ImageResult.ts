export interface ImageResultProcessedStyle {
	type: 'button' | 'pagenum' | 'pageup' | 'pagedown'
	color?: { color: number }
	text?: { text: string; color: number; size: number | 'auto' }
	state?: {
		pushed: boolean

		/** @deprecated */
		cloud: boolean
	}
}

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
	readonly style: ImageResultProcessedStyle

	/**
	 * Last updated time
	 */
	readonly updated: number

	constructor(buffer: Buffer, width: number, height: number, dataUrl: string, style: ImageResultProcessedStyle) {
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
		return this.style.color?.color ?? 0
	}
}
