import { EventEmitter } from 'node:events'
import z from 'zod'
import type { ActiveLearnUpdate } from '@companion-app/shared/Model/ActiveLearn.js'
import { publicProcedure, router, toIterable } from '../UI/TRPC.js'

/**
 * Store for managing active learning requests
 */
export class ActiveLearningStore {
	/**
	 * Active learn requests. Ids of actions & feedbacks
	 */
	readonly #activeLearnRequests = new Map<string, AbortController>()

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
					ids: self.#activeLearnRequests.keys().toArray(),
				} satisfies ActiveLearnUpdate

				for await (const [data] of changes) {
					yield data
				}
			}),

			abort: publicProcedure
				.input(
					z.object({
						id: z.string(),
					})
				)
				.mutation(async ({ input }) => {
					this.#activeLearnRequests.get(input.id)?.abort()
				}),
		})
	}

	/**
	 * Run a learn request within a lock to prevent concurrent learning
	 * @param id - The unique identifier for the learn request
	 * @param callback - Callback that returns a promise to execute the learning logic
	 * @returns Promise that resolves to true if learning was successful
	 */
	async runLearnRequest(id: string, callback: (signal: AbortSignal) => Promise<void>): Promise<void> {
		if (this.#activeLearnRequests.has(id)) {
			throw new Error('Learn is already running')
		}

		const abort = new AbortController()

		try {
			this.#setIsLearning(id, abort)
			await callback(abort.signal)
		} finally {
			this.#setIsLearning(id, null)
		}
	}

	/**
	 * Set an item as learning, or not
	 */
	#setIsLearning(id: string, abortController: AbortController | null): void {
		if (abortController) {
			this.#activeLearnRequests.set(id, abortController)
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
