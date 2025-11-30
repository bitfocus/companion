import { EventEmitter } from 'node:events'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'
import type { ActiveLearnUpdate } from '@companion-app/shared/Model/ActiveLearn.js'

/**
 * Store for managing active learning requests
 */
export class ActiveLearningStore {
	/**
	 * Active learn requests. Ids of actions & feedbacks
	 */
	readonly #activeLearnRequests = new Set<string>()

	readonly #learnEvents = new EventEmitter<{ change: [change: ActiveLearnUpdate] }>()

	constructor() {
		this.#learnEvents.setMaxListeners(0)
	}

	createTrpcRouter() {
		const self = this
		return router({
			watch: publicProcedure.subscription(async function* (opts) {
				const changes = toIterable(self.#learnEvents, 'change', opts.signal)

				yield {
					type: 'init',
					ids: Array.from(self.#activeLearnRequests),
				} satisfies ActiveLearnUpdate

				for await (const [data] of changes) {
					yield data
				}
			}),
		})
	}

	/**
	 * Run a learn request within a lock to prevent concurrent learning
	 * @param id - The unique identifier for the learn request
	 * @param callback - Callback that returns a promise to execute the learning logic
	 * @returns Promise that resolves to true if learning was successful
	 */
	async runLearnRequest(id: string, callback: () => Promise<void>): Promise<void> {
		if (this.#activeLearnRequests.has(id)) {
			throw new Error('Learn is already running')
		}

		try {
			this.#setIsLearning(id, true)
			await callback()
		} finally {
			this.#setIsLearning(id, false)
		}
	}

	/**
	 * Set an item as learning, or not
	 */
	#setIsLearning(id: string, isActive: boolean): void {
		if (isActive) {
			this.#activeLearnRequests.add(id)
			this.#learnEvents.emit('change', {
				type: 'add',
				id,
			})
		} else {
			this.#activeLearnRequests.delete(id)
			this.#learnEvents.emit('change', {
				type: 'remove',
				id,
			})
		}
	}
}
