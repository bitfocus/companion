import debounceFn, { type DebouncedFunction } from 'debounce-fn'

/**
 * Rate limit at which a single connection's variable-value updates are committed.
 * Modules can push values far faster than any surface can display (e.g. a stopwatch ticking every 1ms).
 * Coalescing per connection to ~50Hz avoids flooding the IPC channel and the downstream render pipeline,
 * while keeping updates visually smooth.
 */
export const VARIABLE_UPDATE_THROTTLE_MS = 20

/**
 * Coalesces frequent variable-value updates for a single connection and commits them at a bounded rate.
 *
 * Values are merged latest-wins by their `id`, so a variable that changes many times within a throttle
 * window is only committed once, with its most recent value. The leading edge fires synchronously, so
 * occasional/single updates are committed immediately with no added latency; only bursts are throttled.
 */
export class VariableValueBatcher<T extends { id: string }> {
	readonly #pending = new Map<string, T>()
	readonly #commit: (values: T[]) => void
	readonly #flush: DebouncedFunction<[], void>

	constructor(commit: (values: T[]) => void, throttleMs: number = VARIABLE_UPDATE_THROTTLE_MS) {
		this.#commit = commit
		this.#flush = debounceFn(() => this.#doFlush(), {
			wait: throttleMs,
			maxWait: throttleMs,
			before: true,
			after: true,
		})
	}

	add(values: T[]): void {
		if (values.length === 0) return

		for (const value of values) {
			this.#pending.set(value.id, value)
		}

		this.#flush()
	}

	#doFlush(): void {
		// Guard against the trailing edge firing when the leading edge already drained everything.
		// This also stops the re-arm below from perpetuating an empty timer forever once input goes idle.
		if (this.#pending.size === 0) return

		const values = Array.from(this.#pending.values())
		this.#pending.clear()

		this.#commit(values)

		// Re-arm the throttle window. This keeps the debounce "active" so the leading edge does not
		// immediately re-fire on the next value, holding the sustained commit rate to one per throttle
		// interval (a true ~50Hz cap) instead of the ~2-per-window a plain leading+trailing debounce gives.
		this.#flush()
	}

	destroy(): void {
		this.#flush.cancel()
		this.#pending.clear()
	}
}
