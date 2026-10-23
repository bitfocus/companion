import { selectFrameIndex } from '@companion-app/shared/Graphics/AnimationTiming.js'
import type { DecodedRasterImage, RendererDrawStyle } from '@companion-app/shared/Model/Render.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DecodeImageResult } from './DecodeImage.js'

export type DecodeImageFn = (source: string) => Promise<DecodeImageResult>

/** A size in pixels */
export interface PixelSize {
	width: number
	height: number
}

/** An image fetched for a remote element */
export interface RemoteImage {
	/** Which image this is, eg a remote button at a size. Only the newest revision of each is kept decoded */
	readonly slot: string
	/** Which revision of it this is, so that the image data itself never has to be compared */
	readonly revision: string
	readonly dataUrl: string
}

/** A decoded remote image */
interface RemoteCacheEntry {
	readonly revision: string
	readonly result: DecodeImageResult
	readonly byteSize: number
}

/** Where the images of remote elements are fetched from */
export interface RemoteImageSource {
	/**
	 * The image to draw for a remote element at a size
	 * @param source - the `source` of the element
	 * @param size - the size the element is drawn at, in pixels
	 * @param wait - whether to wait briefly for an image of that size on its way, rather than give the closest there is
	 * @returns the image, or null when there is none
	 */
	getImage(source: string, size: PixelSize, wait: boolean): Promise<RemoteImage | null>
}

/** The frames of the animated images chosen for one render */
export interface AnimationFrames {
	/** The frame to draw of each animated image, keyed by the id of its element */
	readonly frameIndices: ReadonlyMap<string, number>
	/** The longest loop of any of the animations, in ms. 0 when there are none */
	readonly maxDurationMs: number
}

interface CacheEntry {
	readonly result: DecodeImageResult
	/** Approximate memory retained by this entry, including its key */
	readonly byteSize: number
}

/**
 * Caches the decoded form of the images drawn by buttons, so that the render threads can draw them without
 * copying or decoding the source image for every render.
 *
 * The decoding happens in the render threads, into a SharedArrayBuffer which every render thread can read.
 * This store only holds onto those buffers, and never reads them, so the main thread doesn't touch any pixel data.
 *
 * Entries are evicted least recently used first once the cache grows beyond its byte budget. An evicted image is
 * decoded again the next time it is drawn.
 */
export class ImageCacheStore {
	readonly #logger: Logger
	readonly #decodeImage: DecodeImageFn
	readonly #maxBytes: number

	/** The cached entries, keyed by source string. The Map iteration order is used to track the least recently used */
	readonly #entries = new Map<string, CacheEntry>()
	readonly #pending = new Map<string, Promise<CacheEntry | null>>()

	#usedBytes = 0

	/**
	 * The decoded remote images, by slot, least recently used first. Kept apart from the other images, as they change
	 * often and would push those out, and only the newest revision of each is kept
	 */
	readonly #remoteEntries = new Map<string, RemoteCacheEntry>()
	readonly #remotePending = new Map<string, Promise<RemoteCacheEntry | null>>()
	readonly #remoteMaxBytes: number
	#remoteUsedBytes = 0

	/**
	 * @param maxBytes - the budget for the images of elements
	 * @param remoteMaxBytes - the budget for the images of remote elements, which are kept apart
	 */
	constructor(logger: Logger, decodeImage: DecodeImageFn, maxBytes: number, remoteMaxBytes: number) {
		this.#logger = logger
		this.#decodeImage = decodeImage
		this.#maxBytes = maxBytes
		this.#remoteMaxBytes = remoteMaxBytes
	}

	/** Approximate bytes retained by the cache */
	get usedBytes(): number {
		return this.#usedBytes
	}

	get maxBytes(): number {
		return this.#maxBytes
	}

	get entryCount(): number {
		return this.#entries.size
	}

	/**
	 * Choose which frame of each animated image in some elements to draw at a point in time.
	 * This decodes any images which are not yet cached, as that is needed to find whether they are animated
	 * @param elements The elements being drawn
	 * @param timeMs The time being drawn, which should be snapped to the render clock
	 */
	async selectAnimationFrames(elements: SomeButtonGraphicsDrawElement[], timeMs: number): Promise<AnimationFrames> {
		const frameIndices = new Map<string, number>()
		let maxDurationMs = 0

		const visit = async (elements: SomeButtonGraphicsDrawElement[]): Promise<void> => {
			await Promise.all(
				elements.map(async (element) => {
					switch (element.type) {
						case 'image': {
							if (!element.base64Image) return

							const entry = await this.#getEntry(element.base64Image)
							if (!entry || entry.result.type !== 'raster' || entry.result.frameCount <= 1) return

							const { frameStartMs, durationMs } = entry.result
							frameIndices.set(element.id, selectFrameIndex(frameStartMs, durationMs, timeMs))
							maxDurationMs = Math.max(maxDurationMs, durationMs)
							return
						}
						case 'group':
						case 'reference':
							await visit(element.children)
							return
						default:
							return
					}
				})
			)
		}
		await visit(elements)

		return { frameIndices, maxDurationMs }
	}

	/**
	 * Resolve the images in a draw style to their decoded form, ready to send to a render thread
	 * @param drawStyle The style to draw
	 * @param frameIndices The frame to draw of each animated image, keyed by the id of its element
	 * @param contentSize The size of the content of the button being drawn, in pixels, for the remote elements in it
	 * @param remoteImages Where the images of remote elements are fetched from
	 * @param waitForRemoteImages Whether to wait briefly for the image of a remote element on its way (see getImage)
	 */
	async resolveDrawStyle(
		drawStyle: RendererDrawStyle,
		frameIndices: ReadonlyMap<string, number>,
		contentSize: PixelSize,
		remoteImages: RemoteImageSource,
		waitForRemoteImages: boolean
	): Promise<RendererDrawStyle> {
		const decodedImages = new Map<string, DecodedRasterImage>()
		const elements = await this.#resolveElements(
			drawStyle.elements,
			frameIndices,
			decodedImages,
			contentSize,
			remoteImages,
			waitForRemoteImages
		)
		if (decodedImages.size === 0) return drawStyle

		return { ...drawStyle, elements, decodedImages }
	}

	/**
	 * Resolve the images in some elements to their decoded form, collecting them into decodedImages
	 * @param parentSize The size, in pixels, of what the elements are positioned within
	 * @returns The elements, with the source of each decoded image removed. The same array when nothing was changed
	 */
	async #resolveElements(
		elements: SomeButtonGraphicsDrawElement[],
		frameIndices: ReadonlyMap<string, number>,
		decodedImages: Map<string, DecodedRasterImage>,
		parentSize: PixelSize,
		remoteImages: RemoteImageSource,
		waitForRemoteImages: boolean
	): Promise<SomeButtonGraphicsDrawElement[]> {
		let changed = false
		const result = await Promise.all(
			elements.map(async (element): Promise<SomeButtonGraphicsDrawElement> => {
				switch (element.type) {
					case 'image': {
						if (!element.base64Image) return element

						const entry = await this.#getEntry(element.base64Image)
						if (!entry || entry.result.type !== 'raster') return element

						decodedImages.set(element.id, {
							buffer: entry.result.buffer,
							width: entry.result.width,
							height: entry.result.height,
							// The entry could have been evicted and decoded again since the frame was chosen, but it will
							// have decoded to the same frames
							frameIndex: Math.min(frameIndices.get(element.id) ?? 0, entry.result.frameCount - 1),
						})

						changed = true
						// Avoid copying the source to the render thread, as it is no longer needed
						return { ...element, base64Image: null }
					}
					case 'remote': {
						const image = await remoteImages.getImage(
							element.source,
							scaleSize(parentSize, element),
							waitForRemoteImages
						)
						const result = image && (await this.#getRemoteEntry(image))
						if (!result || result.type !== 'raster') return element

						decodedImages.set(element.id, {
							buffer: result.buffer,
							width: result.width,
							height: result.height,
							frameIndex: 0,
						})
						return element
					}
					case 'group':
					case 'reference': {
						const children = await this.#resolveElements(
							element.children,
							frameIndices,
							decodedImages,
							scaleSize(parentSize, element),
							remoteImages,
							waitForRemoteImages
						)
						if (children === element.children) return element

						changed = true
						return { ...element, children }
					}
					default:
						return element
				}
			})
		)

		return changed ? result : elements
	}

	/** The decoded form of a remote image, decoding it unless that revision of it is already */
	async #getRemoteEntry(image: RemoteImage): Promise<DecodeImageResult | null> {
		const held = this.#remoteEntries.get(image.slot)
		if (held?.revision === image.revision) {
			// Mark as most recently used
			this.#remoteEntries.delete(image.slot)
			this.#remoteEntries.set(image.slot, held)
			return held.result
		}

		const pendingKey = `${image.slot}#${image.revision}`
		let pending = this.#remotePending.get(pendingKey)
		if (!pending) {
			pending = this.#decodeImage(image.dataUrl)
				.then((result) => {
					const entry: RemoteCacheEntry = {
						revision: image.revision,
						result,
						byteSize: result.type === 'raster' ? result.buffer.byteLength : 0,
					}
					this.#insertRemote(image.slot, entry)
					return entry
				})
				.catch((e) => {
					this.#logger.warn(`Failed to decode remote image: ${e?.message ?? e}`)
					return null
				})
				.finally(() => this.#remotePending.delete(pendingKey))
			this.#remotePending.set(pendingKey, pending)
		}
		return (await pending)?.result ?? null
	}

	/** Keep a decoded remote image, in place of any other revision of it */
	#insertRemote(slot: string, entry: RemoteCacheEntry): void {
		const replaced = this.#remoteEntries.get(slot)
		if (replaced) {
			this.#remoteEntries.delete(slot)
			this.#remoteUsedBytes -= replaced.byteSize
		}
		this.#remoteEntries.set(slot, entry)
		this.#remoteUsedBytes += entry.byteSize

		// Evict the least recently used, but always keep the one just inserted
		for (const [key, oldEntry] of this.#remoteEntries) {
			if (this.#remoteUsedBytes <= this.#remoteMaxBytes || key === slot) break

			this.#remoteEntries.delete(key)
			this.#remoteUsedBytes -= oldEntry.byteSize
		}
	}

	async #getEntry(source: string): Promise<CacheEntry | null> {
		const entry = this.#entries.get(source)
		if (entry) {
			// Mark as most recently used
			this.#entries.delete(source)
			this.#entries.set(source, entry)
			return entry
		}

		const pending = this.#pending.get(source)
		if (pending) return pending

		const promise = this.#decodeImage(source)
			.then((result) => {
				const newEntry: CacheEntry = {
					result,
					// Strings are stored as up to 2 bytes per character
					byteSize: source.length * 2 + (result.type === 'raster' ? result.buffer.byteLength : 0),
				}
				this.#insert(source, newEntry)
				return newEntry
			})
			.catch((e) => {
				// Don't cache the failure, as it could be the render thread crashing
				this.#logger.warn(`Failed to decode image: ${e?.message ?? e}`)
				return null
			})
			.finally(() => {
				this.#pending.delete(source)
			})

		this.#pending.set(source, promise)
		return promise
	}

	#insert(source: string, entry: CacheEntry): void {
		this.#entries.set(source, entry)
		this.#usedBytes += entry.byteSize

		// Evict the least recently used entries, but always keep the one just inserted
		for (const [key, oldEntry] of this.#entries) {
			if (this.#usedBytes <= this.#maxBytes || key === source) break

			this.#entries.delete(key)
			this.#usedBytes -= oldEntry.byteSize
		}
	}
}

/** The size in pixels of an element positioned within something of a size */
function scaleSize(parentSize: PixelSize, bounds: { width: number; height: number }): PixelSize {
	return {
		width: Math.max(1, Math.round(parentSize.width * bounds.width)),
		height: Math.max(1, Math.round(parentSize.height * bounds.height)),
	}
}
