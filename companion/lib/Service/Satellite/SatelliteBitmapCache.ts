import { createHash } from 'node:crypto'
import { LRUCache } from 'lru-cache'
import type { SatelliteBitmapFormat } from '@companion-app/satellite-protocol'
import type { SurfaceRotation } from '@companion-app/shared/Model/Surfaces.js'
import type { ImageResult } from '../../Graphics/ImageResult.js'

/**
 * Companion's record of the bitmaps a satellite client is caching for one connection.
 *
 * Companion decides what the client stores and what it evicts, so this record is exactly what the client holds:
 * a reference to a bitmap in here never misses. The client is told to store a bitmap when it is first sent, and to
 * evict whatever this record evicts to make room.
 *
 * Each entry is assumed to cost its size as RGBA, until the client reports what it really costs to store.
 */
export class SatelliteBitmapCache {
	/**
	 * The bitmaps the client holds, in order of use. The cache is only used for that order: it never evicts by itself,
	 * as the costs are tracked here, so that a cost can change without counting as a use of the bitmap
	 */
	readonly #entries = new LRUCache<string, { id: string; cost: number }>({
		maxSize: Number.MAX_SAFE_INTEGER,
		sizeCalculation: () => 1,
	})

	#budgetBytes: number
	#usedBytes = 0

	constructor(budgetBytes: number) {
		this.#budgetBytes = budgetBytes
	}

	/** The budget in bytes, as given by the client */
	get budgetBytes(): number {
		return this.#budgetBytes
	}

	/** The total cost of the bitmaps the client is holding */
	get usedBytes(): number {
		return this.#usedBytes
	}

	get entryCount(): number {
		return this.#entries.size
	}

	/**
	 * Check if the client has a bitmap, without counting it as used
	 */
	has(id: string): boolean {
		return this.#entries.has(id)
	}

	/**
	 * Use a bitmap the client has, marking it as recently used
	 * @returns Whether the client has the bitmap
	 */
	reference(id: string): boolean {
		return this.#entries.get(id) !== undefined
	}

	/**
	 * Record that the client is being sent a bitmap to store
	 * @returns The ids the client must evict before storing it, or null if the bitmap is too large to store at all
	 */
	store(id: string, width: number, height: number): string[] | null {
		const cost = width * height * 4
		if (cost <= 0 || cost > this.#budgetBytes) return null

		const existing = this.#entries.peek(id)
		if (existing) this.#usedBytes -= existing.cost

		// As the most recently used, it is never evicted to make room for itself
		this.#entries.set(id, { id, cost })
		this.#usedBytes += cost

		return this.#evictToFit()
	}

	/**
	 * Record what a bitmap really costs the client to store.
	 * This does not count as a use of the bitmap, so it doesn't change which bitmaps are evicted first
	 * @returns The ids the client must evict, if the bitmap now takes the total over budget
	 */
	setCost(id: string, bytes: number): string[] {
		const entry = this.#entries.peek(id)
		if (!entry) return []

		this.#usedBytes += bytes - entry.cost
		entry.cost = bytes

		return this.#evictToFit()
	}

	/**
	 * Change the budget, evicting the least recently used bitmaps until the total fits
	 * @returns The ids the client must evict
	 */
	resize(budgetBytes: number): string[] {
		this.#budgetBytes = budgetBytes

		return this.#evictToFit()
	}

	/**
	 * Evict the least recently used bitmaps until the total is within budget
	 * @returns The evicted ids
	 */
	#evictToFit(): string[] {
		const evicted: string[] = []
		// A budget of 0 empties the cache, even of any bitmaps reported to cost nothing
		while (this.#usedBytes > this.#budgetBytes || (this.#budgetBytes <= 0 && this.#entries.size > 0)) {
			const entry = this.#entries.pop()
			if (!entry) break

			this.#usedBytes -= entry.cost
			evicted.push(entry.id)
		}
		return evicted
	}
}

const bitmapIdCache = new WeakMap<ImageResult, Map<string, string>>()

/**
 * Compute the id of a bitmap sent to a satellite client: a short hash of everything which changes its contents.
 * @returns The id, or null if the render has no content key to identify it by
 */
export function computeBitmapId(
	image: ImageResult,
	width: number,
	height: number,
	rotation: SurfaceRotation | null,
	format: SatelliteBitmapFormat
): string | null {
	if (!image.cacheKey) return null

	let ids = bitmapIdCache.get(image)
	if (!ids) {
		ids = new Map()
		bitmapIdCache.set(image, ids)
	}

	const variant = `${width}x${height}-${rotation ?? ''}-${format}`
	let id = ids.get(variant)
	if (!id) {
		id = createHash('sha1').update(image.cacheKey).update('\0').update(variant).digest('base64url').slice(0, 16)
		ids.set(variant, id)
	}
	return id
}
