import { RENDER_CLOCK_INTERVAL_MS } from '@companion-app/shared/Graphics/AnimationTiming.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import LogController from '../Log/Controller.js'

/**
 * A 10hz render clock for driving clock-sensitive expression re-evaluation.
 * Listeners are notified on each tick, approximately every 100ms.
 */
export class RenderClock {
	readonly #logger = LogController.createLogger('RenderClock')

	readonly #listeners = new Set<() => void>()
	#handle: ReturnType<typeof setInterval> | null = null

	constructor() {
		this.#handle = setInterval(() => {
			for (const listener of this.#listeners) {
				try {
					listener()
				} catch (e) {
					this.#logger.warn(`listener threw an error: ${stringifyError(e)}`)
				}
			}
		}, RENDER_CLOCK_INTERVAL_MS)
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
