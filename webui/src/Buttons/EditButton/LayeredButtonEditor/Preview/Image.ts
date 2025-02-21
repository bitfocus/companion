import { ImageBase } from '@companion-app/shared/Graphics/ImageBase.js'
import type { MinimalLogger } from '@companion-app/shared/Logger.js'

const logger: MinimalLogger = {
	error: (...args) => console.error(...args),
	warn: (...args) => console.warn(...args),
	info: (...args) => console.info(...args),
	debug: (...args) => console.debug(...args),
}

export class GraphicsImage extends ImageBase<HTMLImageElement> {
	readonly #context2d: CanvasRenderingContext2D

	private constructor(context2d: CanvasRenderingContext2D, width: number, height: number) {
		super(logger, context2d, width, height)

		this.#context2d = context2d
	}

	static create(canvas: HTMLCanvasElement): GraphicsImage | null {
		const context2d = canvas.getContext('2d')
		if (!context2d) return null

		const width = canvas.width
		const height = canvas.height

		return new GraphicsImage(context2d, width, height)
	}

	protected drawImage(
		image: HTMLImageElement,
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

		return new Promise<HTMLImageElement>((resolve, reject) => {
			const image = new Image()

			image.onload = () => {
				resolve(image)
			}
			image.onerror = (e) => {
				reject(e)
			}

			image.src = base64Image
		})
	}
	protected loadPixelBuffer(_data: Uint8Array, _width: number, _height: number): HTMLImageElement | null {
		// TODO - implement this
		return null
	}
}
