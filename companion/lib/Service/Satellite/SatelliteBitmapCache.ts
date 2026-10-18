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
	#entries: LRUCache<string, number>

	/** Collects the ids evicted by the current `set`, so they can be returned to the caller */
	#evicted: string[] | null = null

	constructor(budgetBytes: number) {
		this.#entries = this.#createEntries(budgetBytes)
	}

	#createEntries(budgetBytes: number): LRUCache<string, number> {
		return new LRUCache<string, number>({
			maxSize: budgetBytes,
			sizeCalculation: (cost) => cost,
			dispose: (_cost, id, reason) => {
				if (reason === 'evict') this.#evicted?.push(id)
			},
		})
	}

	/** The budget in bytes, as given by the client */
	get budgetBytes(): number {
		return this.#entries.maxSize
	}

	/** The total cost of the bitmaps the client is holding */
	get usedBytes(): number {
		return this.#entries.calculatedSize
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
		if (cost <= 0 || cost > this.budgetBytes) return null

		return this.#setCollectingEvictions(id, cost)
	}

	/**
	 * Record what a bitmap really costs the client to store.
	 * As lru-cache has no way to change the size of an entry in place, this also counts as a use of the bitmap.
	 * @returns The ids the client must evict, if the bitmap now takes the total over budget
	 */
	setCost(id: string, bytes: number): string[] {
		if (!this.#entries.has(id)) return []

		if (bytes > this.budgetBytes) {
			// It can no longer fit at all, so this is the one to go
			this.#entries.delete(id)
			return [id]
		}

		return this.#setCollectingEvictions(id, Math.max(bytes, 1))
	}

	/**
	 * Change the budget, evicting the least recently used bitmaps until the total fits
	 * @returns The ids the client must evict
	 */
	resize(budgetBytes: number): string[] {
		const previous = this.#entries
		if (budgetBytes <= 0) {
			const evicted = [...previous.keys()]
			previous.clear()
			return evicted
		}

		const next = this.#createEntries(budgetBytes)
		// Insert from least to most recently used, so the order is kept and the oldest are the ones to go
		for (const id of previous.rkeys()) {
			const cost = previous.peek(id)
			if (cost !== undefined && cost <= budgetBytes) next.set(id, cost)
		}
		this.#entries = next

		return [...previous.keys()].filter((id) => !next.has(id))
	}

	#setCollectingEvictions(id: string, cost: number): string[] {
		const evicted: string[] = []
		this.#evicted = evicted
		try {
			this.#entries.set(id, cost)
		} finally {
			this.#evicted = null
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
