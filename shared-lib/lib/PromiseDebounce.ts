/**
 * Copied from Sofie https://github.com/nrkno/sofie-core
 * Based on https://github.com/sindresorhus/p-debounce
 * With additional features:
 * - `cancelWaiting` method
 * - ensures only one execution in progress at a time
 */
export class PromiseDebounce<TResult = void, TArgs extends unknown[] = []> {
	readonly #fn: (...args: TArgs) => Promise<TResult>
	readonly #wait: number
	readonly #maxWait: number | undefined

	/** If an execution timeout has passed while  */
	#pendingArgs: TArgs | null = null
	#timeout: NodeJS.Timeout | undefined
	#lastRun: number

	#isExecuting = false
	#waitingListeners: Listener<TResult>[] = []

	constructor(fn: (...args: TArgs) => Promise<TResult>, wait: number, maxWait?: number) {
		this.#fn = fn
		this.#wait = wait
		this.#maxWait = maxWait

		this.#lastRun = Date.now() - wait
	}

	/**
	 * Trigger an execution, and get the result.
	 * @returns A promise that resolves with the result of the function
	 */
	call = async (...args: TArgs): Promise<TResult> => {
		return new Promise<TResult>((resolve, reject) => {
			const listener: Listener<TResult> = { resolve, reject }
			this.#waitingListeners.push(listener)

			// Trigger an execution
			this.trigger(...args)
		})
	}

	/**
	 * Trigger an execution, but don't report the result.
	 */
	trigger = (...args: TArgs): void => {
		// If an execution is 'imminent', don't do anything
		if (this.#pendingArgs) {
			this.#pendingArgs = args
			return
		}

		// Clear an existing timeout
		if (this.#timeout) clearTimeout(this.#timeout)

		let waitTime = this.#wait
		if (this.#maxWait !== undefined) {
			// A max wait is set, so we need to check if the waitTime should be adjusted
			const latestAllowedRun = this.#lastRun + this.#maxWait
			waitTime = Math.min(this.#wait, latestAllowedRun - Date.now())
		}

		// Start a new one
		this.#timeout = setTimeout(() => {
			this.#timeout = undefined

			this.executeFn(args)
		}, waitTime)
	}

	private executeFn(args: TArgs): void {
		// If an execution is still in progress, mark as pending and stop
		if (this.#isExecuting) {
			this.#pendingArgs = args
			return
		}

		this.#lastRun = Date.now()

		// We have the clear to begin executing
		this.#isExecuting = true
		this.#pendingArgs = null

		// Collect up the listeners for this execution
		const listeners = this.#waitingListeners
		this.#waitingListeners = []

		Promise.resolve()
			.then(async () => {
				const result = await this.#fn(...args)
				for (const listener of listeners) {
					listener.resolve(result)
				}
			})
			.catch((error) => {
				for (const listener of listeners) {
					listener.reject(error)
				}
			})
			.finally(() => {
				this.#isExecuting = false

				// If there is a pending execution, run that soon
				if (this.#pendingArgs) {
					const args = this.#pendingArgs
					setTimeout(() => this.executeFn(args), 0)
				}
			})
	}

	/**
	 * Cancel any waiting execution
	 */
	cancelWaiting = (error?: Error): void => {
		this.#pendingArgs = null

		if (this.#timeout) {
			clearTimeout(this.#timeout)
			this.#timeout = undefined
		}

		// Inform any listeners
		if (this.#waitingListeners.length > 0) {
			const listeners = this.#waitingListeners
			this.#waitingListeners = []

			error = error ?? new Error('Cancelled')

			// Inform the listeners in the next tick
			setImmediate(() => {
				for (const listener of listeners) {
					listener.reject(error)
				}
			})
		}
	}
}

interface Listener<TResult> {
	resolve: (value: TResult) => void
	reject: (reason?: any) => void
}
