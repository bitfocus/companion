import { createHash } from 'node:crypto'
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
	 * The cost of each bitmap the client holds, from least to most recently used.
	 * A Map keeps insertion order, and setting an existing key keeps its place, so using a bitmap is a delete and
	 * re-insert, while changing its cost is not
	 */
	readonly #costs = new Map<string, number>()

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
		return this.#costs.size
	}

	/**
	 * Check if the client has a bitmap, without counting it as used
	 */
	has(id: string): boolean {
		return this.#costs.has(id)
	}

	/**
	 * Use a bitmap the client has, marking it as the most recently used
	 * @returns Whether the client has the bitmap
	 */
	reference(id: string): boolean {
		const cost = this.#costs.get(id)
		if (cost === undefined) return false

		this.#costs.delete(id)
		this.#costs.set(id, cost)
		return true
	}

	/**
	 * Record that the client is being sent a bitmap to store
	 * @returns The ids the client must evict before storing it, or null if the bitmap is too large to store at all
	 */
	store(id: string, width: number, height: number): string[] | null {
		const cost = width * height * 4
		if (cost <= 0 || cost > this.#budgetBytes) return null

		const existing = this.#costs.get(id)
		if (existing !== undefined) {
			this.#usedBytes -= existing
			this.#costs.delete(id)
		}

		// As the most recently used, it is never evicted to make room for itself
		this.#costs.set(id, cost)
		this.#usedBytes += cost

		return this.#evictToFit()
	}

	/**
	 * Record what a bitmap really costs the client to store.
	 *
	 * This does not count as a use of the bitmap, so it doesn't change which bitmaps are evicted first. When a higher
	 * cost takes the total over budget, the bitmap competes on its true recency like any other, so it can be the one
	 * evicted. Protecting it would mean evicting bitmaps which were used more recently, and are more likely to be
	 * needed again, while evicting it only costs sending it again if it is ever drawn
	 * @returns The ids the client must evict, if the total is now over budget
	 */
	setCost(id: string, bytes: number): string[] {
		const previous = this.#costs.get(id)
		if (previous === undefined) return []

		this.#costs.set(id, bytes)
		this.#usedBytes += bytes - previous

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
		for (const [id, cost] of this.#costs) {
			// A budget of 0 empties the cache, even of any bitmaps reported to cost nothing
			if (this.#usedBytes <= this.#budgetBytes && this.#budgetBytes > 0) break

			this.#costs.delete(id)
			this.#usedBytes -= cost
			evicted.push(id)
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
