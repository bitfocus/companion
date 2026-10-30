/**
 * Pools of reusable images, keyed by size. A pool that hasn't been used for a while is dropped, so sizes that are
 * only drawn briefly (eg while the editor preview is resized) don't keep their images forever.
 */
export class ImagePools<TImage> {
	readonly #pools = new Map<string, { images: TImage[]; lastUsed: number }>()
	readonly #maxIdleMs: number
	readonly #now: () => number

	#lastPrune: number

	constructor(maxIdleMs: number, now: () => number) {
		this.#maxIdleMs = maxIdleMs
		this.#now = now
		this.#lastPrune = now()
	}

	get size(): number {
		return this.#pools.size
	}

	/**
	 * Get the pool for a key, creating it if needed, and drop any pools that have gone unused.
	 * A dropped pool can still have images returned to it by draws in flight; they are simply discarded with it.
	 */
	get(key: string): TImage[] {
		const now = this.#now()

		// Checked at most once per idle period, so a busy pool pays nothing for it
		if (now - this.#lastPrune >= this.#maxIdleMs) {
			this.#lastPrune = now
			for (const [poolKey, pool] of this.#pools) {
				if (now - pool.lastUsed >= this.#maxIdleMs) this.#pools.delete(poolKey)
			}
		}

		let pool = this.#pools.get(key)
		if (!pool) {
			pool = { images: [], lastUsed: now }
			this.#pools.set(key, pool)
		}
		pool.lastUsed = now

		return pool.images
	}
}
