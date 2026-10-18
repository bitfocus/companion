import { RENDER_CLOCK_INTERVAL_MS, selectFrameIndex } from '@companion-app/shared/Graphics/AnimationTiming.js'
import type { DecodedRasterImage, RendererDrawStyle } from '@companion-app/shared/Model/Render.js'
import type { SomeButtonGraphicsDrawElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import type { Logger } from '../../Log/Controller.js'
import type { DecodeImageResult } from './DecodeImage.js'

export type DecodeImageFn = (source: string) => Promise<DecodeImageResult>

/** The frames of the animated images chosen for one render */
export interface AnimationFrames {
	/** The frame to draw of each animated image, keyed by the id of its element */
	readonly frameIndices: ReadonlyMap<string, number>
	/** The longest loop of any of the animations, in ms. 0 when there are none */
	readonly maxDurationMs: number
	/**
	 * How many different renders there can be in one cycle of all the animations together, before they repeat.
	 * This is an upper bound, and 1 when there are no animations
	 */
	readonly cycleRenderCount: number
}

/** One animation drawn on a render, for counting the renders in a cycle */
export interface CycleAnimation {
	readonly frameCount: number
	/** The length of one loop, in ms, which is a multiple of the render clock interval */
	readonly durationMs: number
}

/** Beyond this many render clock ticks a cycle is effectively endless, which also keeps the maths exact */
const MAX_CYCLE_TICKS = 1_000_000_000

function greatestCommonDivisor(a: number, b: number): number {
	while (b) [a, b] = [b, a % b]
	return a
}

/**
 * Count how many different renders there can be in one cycle of some animations drawn together.
 * The animations repeat together after the least common multiple of their loops, and within that the render only
 * changes when one of them moves to its next frame, so the count is at most the total number of frames shown in the
 * cycle, and at most one per tick of the render clock
 */
export function countCycleRenders(animations: readonly CycleAnimation[]): number {
	if (animations.length === 0) return 1

	let cycleTicks = 1
	for (const { durationMs } of animations) {
		const ticks = Math.max(1, Math.round(durationMs / RENDER_CLOCK_INTERVAL_MS))
		cycleTicks = Math.min(MAX_CYCLE_TICKS, (cycleTicks / greatestCommonDivisor(cycleTicks, ticks)) * ticks)
	}

	let framesInCycle = 0
	for (const { frameCount, durationMs } of animations) {
		const ticks = Math.max(1, Math.round(durationMs / RENDER_CLOCK_INTERVAL_MS))
		framesInCycle += frameCount * Math.ceil(cycleTicks / ticks)
	}

	return Math.min(cycleTicks, framesInCycle)
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

	constructor(logger: Logger, decodeImage: DecodeImageFn, maxBytes: number) {
		this.#logger = logger
		this.#decodeImage = decodeImage
		this.#maxBytes = maxBytes
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
		const animations: CycleAnimation[] = []
		let maxDurationMs = 0

		const visit = async (elements: SomeButtonGraphicsDrawElement[]): Promise<void> => {
			await Promise.all(
				elements.map(async (element) => {
					switch (element.type) {
						case 'image': {
							if (!element.base64Image) return

							const entry = await this.#getEntry(element.base64Image)
							if (!entry || entry.result.type !== 'raster' || entry.result.frameCount <= 1) return

							const { frameStartMs, durationMs, frameCount } = entry.result
							frameIndices.set(element.id, selectFrameIndex(frameStartMs, durationMs, timeMs))
							animations.push({ frameCount, durationMs })
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

		return { frameIndices, maxDurationMs, cycleRenderCount: countCycleRenders(animations) }
	}

	/**
	 * Resolve the images in a draw style to their decoded form, ready to send to a render thread
	 * @param drawStyle The style to draw
	 * @param frameIndices The frame to draw of each animated image, keyed by the id of its element
	 */
	async resolveDrawStyle(
		drawStyle: RendererDrawStyle,
		frameIndices: ReadonlyMap<string, number>
	): Promise<RendererDrawStyle> {
		const decodedImages = new Map<string, DecodedRasterImage>()
		const elements = await this.#resolveElements(drawStyle.elements, frameIndices, decodedImages)
		if (decodedImages.size === 0) return drawStyle

		return { ...drawStyle, elements, decodedImages }
	}

	/**
	 * Resolve the images in some elements to their decoded form, collecting them into decodedImages
	 * @returns The elements, with the source of each decoded image removed. The same array when nothing was changed
	 */
	async #resolveElements(
		elements: SomeButtonGraphicsDrawElement[],
		frameIndices: ReadonlyMap<string, number>,
		decodedImages: Map<string, DecodedRasterImage>
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
					case 'group':
					case 'reference': {
						const children = await this.#resolveElements(element.children, frameIndices, decodedImages)
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
