import type { ClientSocket, UIHandler } from '../UI/Handler.js'

const ActiveLearnRoom = 'learn:active'

/**
 * Store for managing active learning requests
 */
export class ActiveLearningStore {
	/**
	 * Active learn requests. Ids of actions & feedbacks
	 */
	readonly #activeLearnRequests = new Set<string>()

	readonly #io: UIHandler

	constructor(io: UIHandler) {
		this.#io = io
	}

	/**
	 * Setup a new socket client's events for active learning
	 */
	clientConnect(client: ClientSocket): void {
		client.onPromise('controls:subscribe:learn', async () => {
			client.join(ActiveLearnRoom)

			return Array.from(this.#activeLearnRequests)
		})
		client.onPromise('controls:unsubscribe:learn', async () => {
			client.leave(ActiveLearnRoom)
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
			this.#io.emitToRoom(ActiveLearnRoom, 'learn:add', id)
		} else {
			this.#activeLearnRequests.delete(id)
			this.#io.emitToRoom(ActiveLearnRoom, 'learn:remove', id)
		}
	}
}
