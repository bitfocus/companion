import { selectFrameIndex, snapToRenderClock } from '@companion-app/shared/Graphics/AnimationTiming.js'
import { ImageBase, ImagePoolBase, type TextLayoutCache } from '@companion-app/shared/Graphics/ImageBase.js'
import type { MinimalLogger } from '@companion-app/shared/Logger.js'
import { decodeAnimatedImage, type DecodedAnimation } from './AnimatedImageDecoder.js'
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

	createImage(textLayoutCache: TextLayoutCache | null): GraphicsImage {
		const canvas = document.createElement('canvas')
		canvas.width = this.#width
		canvas.height = this.#height

		const context2d = canvas.getContext('2d')
		if (!context2d) throw new Error('Failed to get 2d context')

		return new GraphicsImage(this, canvas, context2d, this.#width, this.#height, textLayoutCache)
	}
}

type ParsedImage = { type: 'static'; image: HTMLImageElement } | ({ type: 'animated' } & DecodedAnimation)

type DrawableImage = HTMLImageElement | HTMLCanvasElement | ImageBitmap

export class GraphicsImage extends ImageBase<DrawableImage> {
	readonly #canvas: HTMLCanvasElement
	readonly #context2d: CanvasRenderingContext2D

	readonly #parseCache = new LastUsedCache<ParsedImage>()

	/** Whether an animated image has been drawn since the last `drawComplete` */
	#drawingAnimation = false
	#lastDrawWasAnimated = false

	/** Whether the last completed draw included an animated image, so it needs drawing again on the next tick */
	get lastDrawWasAnimated(): boolean {
		return this.#lastDrawWasAnimated
	}

	protected get canvasImage(): HTMLCanvasElement {
		return this.#canvas
	}

	constructor(
		pool: GraphicsImagePool,
		canvas: HTMLCanvasElement,
		context2d: CanvasRenderingContext2D,
		width: number,
		height: number,
		textLayoutCache: TextLayoutCache | null
	) {
		super(logger, pool, context2d, width, height, textLayoutCache)

		this.#canvas = canvas
		this.#context2d = context2d

		this.initialiseContext()
	}

	/**
	 * Re-apply any initial context state that must survive a `reset()`.
	 */
	protected override initialiseContext(): void {
		// Nothing currently
	}

	static create(canvas: HTMLCanvasElement, textLayoutCache: TextLayoutCache | null): GraphicsImage | null {
		const context2d = canvas.getContext('2d')
		if (!context2d) return null

		const width = canvas.width
		const height = canvas.height

		const pool = new GraphicsImagePool(width, height)
		return new GraphicsImage(pool, canvas, context2d, width, height, textLayoutCache)
	}

	protected drawImage(
		image: DrawableImage,
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
	protected async loadBase64Image(base64Image: string): Promise<DrawableImage> {
		base64Image = base64Image.trim()

		// Ensure the base64 image is a data URL, from older companion it may not be
		if (!base64Image.startsWith('data:image')) {
			base64Image = 'data:image/png;base64,' + base64Image
		}

		let parsed = this.#parseCache.get(base64Image)
		if (!parsed) {
			parsed = await this.#parseImage(base64Image)
			if (parsed.type === 'animated') {
				const frames = parsed.frames
				this.#parseCache.set(base64Image, parsed, () => {
					for (const frame of frames) frame.close()
				})
			} else {
				this.#parseCache.set(base64Image, parsed)
			}
		}

		if (parsed.type === 'static') return parsed.image

		// Show the same frame as the button does at this moment
		this.#drawingAnimation = true
		return parsed.frames[selectFrameIndex(parsed.frameStartMs, parsed.durationMs, snapToRenderClock(Date.now()))]
	}

	async #parseImage(dataUrl: string): Promise<ParsedImage> {
		try {
			const animation = await decodeAnimatedImage(dataUrl)
			if (animation) return { type: 'animated', ...animation }
		} catch (e) {
			logger.warn('Failed to decode animated image, showing it as a still', e)
		}

		return new Promise<ParsedImage>((resolve, reject) => {
			const image = new Image()

			image.onload = () => resolve({ type: 'static', image })
			image.onerror = (e) => {
				reject(new Error(typeof e === 'string' ? e : 'Failed to load image'))
			}

			image.src = dataUrl
		})
	}
	protected loadPixelBuffer(_data: Uint8Array, _width: number, _height: number): DrawableImage | null {
		// TODO - implement this
		return null
	}

	public drawComplete(): void {
		this.#parseCache.disposeUnused()

		this.#lastDrawWasAnimated = this.#drawingAnimation
		this.#drawingAnimation = false
	}
}
