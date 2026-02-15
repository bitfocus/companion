import EventEmitter from 'node:events'
import * as imageRs from '@julusian/image-rs'
import LogController from '../Log/Controller.js'
import type { GraphicsController } from '../Graphics/Controller.js'
import type { ImageResult } from '../Graphics/ImageResult.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import type { SubscriptionManager } from './SubscriptionManager.js'

/** Key for cached bitmaps: page:row:col:widthxheight */
type BitmapCacheKey = `${number}:${number}:${number}:${number}x${number}`

/** A rendered bitmap ready to be published */
export interface RenderedBitmap {
	page: number
	row: number
	col: number
	width: number
	height: number
	/** PNG data URL string, JSON-safe */
	dataUrl: string
	/** Whether the button is currently pressed */
	pressed: boolean
}

export type BitmapRendererEvents = {
	/** Emitted when a bitmap has been rendered and is ready to publish */
	bitmapReady: [bitmap: RenderedBitmap]
}

/**
 * Handles scaling and encoding button bitmaps for Link.
 *
 * Listens to the GraphicsController's `button_drawn` events, and when a button
 * that has active subscriptions changes, scales it to each requested resolution
 * using image-rs, encodes to a PNG data URL, and emits `bitmapReady`.
 */
export class BitmapRenderer extends EventEmitter<BitmapRendererEvents> {
	readonly #logger = LogController.createLogger('Link/BitmapRenderer')
	readonly #graphics: GraphicsController
	readonly #subscriptionManager: SubscriptionManager

	/** Cache of data URLs keyed by location + resolution */
	readonly #cache = new Map<BitmapCacheKey, string>()

	/** Bound handler for button_drawn events */
	readonly #onButtonDrawn: (location: ControlLocation, render: ImageResult) => void

	constructor(graphics: GraphicsController, subscriptionManager: SubscriptionManager) {
		super()
		this.setMaxListeners(0)
		this.#graphics = graphics
		this.#subscriptionManager = subscriptionManager

		this.#onButtonDrawn = (location, render) => {
			this.#handleButtonDrawn(location, render)
		}
	}

	/**
	 * Start listening for button state changes.
	 */
	start(): void {
		this.#graphics.on('button_drawn', this.#onButtonDrawn)
	}

	/**
	 * Stop listening and clear cache.
	 */
	stop(): void {
		this.#graphics.off('button_drawn', this.#onButtonDrawn)
		this.#cache.clear()
	}

	/**
	 * Get the current bitmap for a button on demand at a specific resolution.
	 * Used for initial state when a subscription is first created.
	 */
	async renderOnDemand(
		page: number,
		row: number,
		col: number,
		width: number,
		height: number
	): Promise<RenderedBitmap | null> {
		const location: ControlLocation = { pageNumber: page, row, column: col }
		const cached = this.#graphics.getCachedRender(location)
		if (!cached) return null

		// Extract pressed state from ImageResult style
		const pressed = typeof cached.style === 'object' && cached.style.style === 'button' ? cached.style.pushed : false

		const dataUrl = await this.#scaleToDataUrl(cached, width, height)
		const cacheKey = this.#makeCacheKey(page, row, col, width, height)
		this.#cache.set(cacheKey, dataUrl)

		return { page, row, col, width, height, dataUrl, pressed }
	}

	/**
	 * Get a cached data URL if available (no re-render).
	 */
	getCached(page: number, row: number, col: number, width: number, height: number): string | undefined {
		return this.#cache.get(this.#makeCacheKey(page, row, col, width, height))
	}

	/**
	 * Remove cached data URLs for a location at all resolutions.
	 * Called when the last subscriber at a given resolution unsubscribes.
	 */
	evictCache(page: number, row: number, col: number, width: number, height: number): void {
		this.#cache.delete(this.#makeCacheKey(page, row, col, width, height))
	}

	/**
	 * Handle a button being redrawn by the graphics controller.
	 * Scale to each subscribed resolution and emit bitmapReady.
	 */
	#handleButtonDrawn(location: ControlLocation, render: ImageResult): void {
		const page = location.pageNumber
		const row = location.row
		const col = location.column

		// Extract pressed state from ImageResult style
		const pressed = typeof render.style === 'object' && render.style.style === 'button' ? render.style.pushed : false

		// Get all resolutions subscribed for this location
		const resolutions = this.#subscriptionManager.getResolutionsForLocation(page, row, col)
		if (resolutions.length === 0) return

		// Scale and emit for each resolution
		for (const { width, height } of resolutions) {
			this.#scaleToDataUrl(render, width, height)
				.then((dataUrl) => {
					const cacheKey = this.#makeCacheKey(page, row, col, width, height)
					this.#cache.set(cacheKey, dataUrl)
					this.emit('bitmapReady', { page, row, col, width, height, dataUrl, pressed })
				})
				.catch((err) => {
					this.#logger.warn(`Failed to scale bitmap for ${page}/${row}/${col} @ ${width}x${height}: ${err}`)
				})
		}
	}

	/**
	 * Scale an ImageResult to the target resolution and return a PNG data URL.
	 */
	async #scaleToDataUrl(render: ImageResult, width: number, height: number): Promise<string> {
		const image = imageRs.ImageTransformer.fromBuffer(
			render.buffer,
			render.bufferWidth,
			render.bufferHeight,
			'rgba'
		).scale(width, height, 'Fit')

		return image.toDataUrl('png')
	}

	#makeCacheKey(page: number, row: number, col: number, width: number, height: number): BitmapCacheKey {
		return `${page}:${row}:${col}:${width}x${height}`
	}
}
