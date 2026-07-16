/**
 * A 10hz render clock for driving clock-sensitive expression re-evaluation.
 * Listeners are notified on each tick, approximately every 100ms.
 */
export class RenderClock {
	readonly #listeners = new Set<() => void>()
	#handle: ReturnType<typeof setInterval> | null = null

	constructor() {
		this.#handle = setInterval(() => {
			for (const listener of this.#listeners) {
				listener()
			}
		}, 100)
	}

	subscribe(listener: () => void): () => void {
		this.#listeners.add(listener)
		return () => this.#listeners.delete(listener)
	}

	destroy(): void {
		if (this.#handle !== null) {
			clearInterval(this.#handle)
			this.#handle = null
		}
	}
}
