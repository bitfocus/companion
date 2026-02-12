import { expect, vi } from 'vitest'

/**
 * Utility for testing TRPC subscriptions with timeout protection and optional timer draining.
 *
 * Prevents test hangs when subscriptions don't yield expected values by wrapping
 * iterator operations with configurable timeouts.
 *
 * @example
 * ```ts
 * const subscription = new SubscriptionTester(await caller.someSubscription())
 * await subscription.expectValue({ type: 'init', data: {} })
 * // ...trigger some change...
 * await subscription.expectValue({ type: 'update', data: {} })
 * await subscription.cleanup()
 * ```
 */
export class SubscriptionTester<T> {
	private iter: AsyncIterator<T>
	private timeoutMs: number
	private drainTimersBeforeNext: boolean

	constructor(
		iterable: AsyncIterable<T>,
		options?: {
			timeoutMs?: number
			drainTimersBeforeNext?: boolean
		}
	) {
		this.iter = iterable[Symbol.asyncIterator]()
		this.timeoutMs = options?.timeoutMs ?? 200
		this.drainTimersBeforeNext = options?.drainTimersBeforeNext ?? false
	}

	/**
	 * Get the next value from the subscription with timeout protection.
	 * Optionally drains pending timers before reading if configured.
	 */
	async next(): Promise<T> {
		if (this.drainTimersBeforeNext) {
			await vi.runOnlyPendingTimersAsync()
		}

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Subscription timeout after ${this.timeoutMs}ms`)), this.timeoutMs)
		})

		const result = await Promise.race([this.iter.next(), timeoutPromise])

		if (result.done) {
			throw new Error('Subscription ended unexpectedly')
		}

		return result.value
	}

	/**
	 * Convenience method to get next value and assert it matches expected.
	 */
	async expectValue(expected: T): Promise<void> {
		const value = await this.next()
		expect(value).toEqual(expected)
	}

	/**
	 * Cleanup the subscription with timeout protection.
	 */
	async cleanup(): Promise<void> {
		if (!this.iter.return) return

		const timeoutPromise = new Promise<never>((_, reject) => {
			setTimeout(() => reject(new Error(`Subscription cleanup timeout after ${this.timeoutMs}ms`)), this.timeoutMs)
		})

		await Promise.race([this.iter.return(), timeoutPromise])
	}
}
