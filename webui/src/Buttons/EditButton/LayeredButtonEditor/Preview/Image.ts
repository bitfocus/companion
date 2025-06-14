import { ImageBase, ImagePoolBase } from '@companion-app/shared/Graphics/ImageBase.js'
import type { MinimalLogger } from '@companion-app/shared/Logger.js'
import { LastUsedCache } from './DrawStyleParser.js'

const logger: MinimalLogger = {
	error: (...args) => console.error(...args),
	warn: (...args) => console.warn(...args),
	info: (...args) => console.info(...args),
	debug: (...args) => console.debug(...args),
}

class GraphicsImagePool extends ImagePoolBase<GraphicsImage> {
	readonly #width: number
	readonly #height: number

	constructor(width: number, height: number) {
		super()

		this.#width = width
		this.#height = height
	}

	createImage(): GraphicsImage {
		const canvas = document.createElement('canvas')
		canvas.width = this.#width
		canvas.height = this.#height

		const context2d = canvas.getContext('2d')
		if (!context2d) throw new Error('Failed to get 2d context')

		return new GraphicsImage(this, canvas, context2d, this.#width, this.#height)
	}
}

export class GraphicsImage extends ImageBase<HTMLImageElement | HTMLCanvasElement> {
	readonly #canvas: HTMLCanvasElement
	readonly #context2d: CanvasRenderingContext2D

	readonly #parseCache = new LastUsedCache<HTMLImageElement>()

	protected get canvasImage(): HTMLCanvasElement {
		return this.#canvas
	}

	constructor(
		pool: GraphicsImagePool,
		canvas: HTMLCanvasElement,
		context2d: CanvasRenderingContext2D,
		width: number,
		height: number
	) {
		super(logger, pool, context2d, width, height)

		this.#canvas = canvas
		this.#context2d = context2d
	}

	static create(canvas: HTMLCanvasElement): GraphicsImage | null {
		const context2d = canvas.getContext('2d')
		if (!context2d) return null

		const width = canvas.width
		const height = canvas.height

		const pool = new GraphicsImagePool(width, height)
		return new GraphicsImage(pool, canvas, context2d, width, height)
	}

	protected drawImage(
		image: HTMLImageElement | HTMLCanvasElement,
		sx: number,
		sy: number,
		sw: number,
		sh: number,
		dx: number,
		dy: number,
		dw: number,
		dh: number
	): void {
		this.#context2d.drawImage(image, sx, sy, sw, sh, dx, dy, dw, dh)
	}
	protected async loadBase64Image(base64Image: string): Promise<HTMLImageElement> {
		// Ensure the base64 image is a data URL, from older companion it may not be
		if (!base64Image.startsWith('data:image')) {
			base64Image = 'data:image/png;base64,' + base64Image
		}

		const cached = this.#parseCache.get(base64Image)
		if (cached) return cached

		return new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image()

			image.onload = () => {
				this.#parseCache.set(base64Image, image)
				resolve(image)
			}
			image.onerror = (e) => {
				reject(new Error(typeof e === 'string' ? e : 'Failed to load image'))
			}

			image.src = base64Image
		})
	}
	protected loadPixelBuffer(_data: Uint8Array, _width: number, _height: number): HTMLImageElement | null {
		// TODO - implement this
		return null
	}

	public drawComplete(): void {
		this.#parseCache.disposeUnused()
	}
}
